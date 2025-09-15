// Street Sweeper 13 - minimal game loop and state machine

/** @enum {number} */
const GameState = {
  START: 0,
  RUN: 1,
  OVER: 2,
};

let state = GameState.START;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// UI elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const overScreen = document.getElementById('over-screen');
const overFinal = document.getElementById('over-final');
const overBest = document.getElementById('over-best');

const startBtn = document.getElementById('start-btn');
const gameOverBtn = document.getElementById('gameover-btn');
const restartBtn = document.getElementById('restart-btn');
const backBtn = document.getElementById('back-btn');

function setState(next) {
  state = next;
  // Toggle screens
  startScreen.classList.toggle('hidden', state !== GameState.START);
  gameScreen.classList.toggle('hidden', state !== GameState.RUN);
  overScreen.classList.toggle('hidden', state !== GameState.OVER);
}

startBtn.addEventListener('click', () => setState(GameState.RUN));
gameOverBtn.addEventListener('click', () => setState(GameState.OVER));
restartBtn.addEventListener('click', () => setState(GameState.RUN));
backBtn.addEventListener('click', () => setState(GameState.START));

// Simple fixed clear color for visibility
const CLEAR_COLOR = '#101820'; // deep navy
const HUD_COLOR = '#eaeaea';
const DEBUG = false; // set to true to show debug overlays

// Lanes and player config
const LANES = 3;
const PLAYER_X = 40; // fixed left-side x
const PLAYER_W = 18;
const PLAYER_H = 18;
const PLAYER_COLOR = '#00d18f';
const LETTER_SIZE = 18;
const MAX_PER_LANE = 3;

// Game progression / HUD
const WORDS = ["POULET", "CHAT", "BUS"]; // target words
let targetWord = "";
let currentIndex = 0; // next required letter index
let score = 0;
let lives = 3;
let playerFlashTimer = 0; // seconds remaining to flash player after wrong hit
const PLAYER_FLASH_TIME = 0.2;
// Difficulty ramp for letter speeds
let letterSpeedMin = 60; // px/s
let letterSpeedMax = 80; // px/s
const SPEED_INCREMENT = 5; // per completed word

// Timer / scoring persistence
const ROUND_TIME_START = 45; // seconds
let timeLeft = ROUND_TIME_START;
let bestScore = Number(localStorage.getItem('ss13_best') || '0');
// Cities / levels ----------------------------------------------------------
const CITIES = [
  { name: 'Marseille', bgColor: '#4477aa' },
  { name: 'Paris', bgColor: '#888888' },
  { name: 'Tokyo', bgColor: '#aa4477' },
  { name: 'New York', bgColor: '#ffaa44' },
];
let cityIndex = 0; // index into CITIES
let wordsCompleted = 0; // total words completed this run
let levelUpTimer = 0; // seconds remaining for level-up banner
// Floating feedback texts
/** @type {{text:string,x:number,y:number,alpha:number,vy:number,color:string,life:number}[]} */
let floaters = [];
function addFloater(text, x, y, color = '#ffffff') {
  floaters.push({ text, x, y, alpha: 1, vy: -24, color, life: 1.0 }); // ~1s life
}

/**
 * Compute the center Y for a lane index [0..LANES-1]
 * Evenly spaces lanes across the canvas height (centers at 1/(L+1), ..., L/(L+1)).
 */
function laneCenterY(idx) {
  const spacing = canvas.height / (LANES + 1);
  return Math.round(spacing * (idx + 1));
}

class Player {
  constructor() {
    this.x = PLAYER_X; // left edge
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.lane = 1; // start in middle lane [0,1,2]
  }

  reset() {
    this.lane = 1;
  }

  moveUp() {
    if (this.lane > 0) this.lane -= 1;
  }

  moveDown() {
    if (this.lane < LANES - 1) this.lane += 1;
  }

  draw(ctx) {
    const cy = laneCenterY(this.lane);
    // draw as a simple rounded rectangle placeholder
    ctx.fillStyle = PLAYER_COLOR;
    const x = this.x;
    const y = cy - this.h / 2;
    // simple rect for now
    ctx.fillRect(x, y, this.w, this.h);
  }
}

/** @type {Player | null} */
let player = null;

// Letters (moving obstacles/targets) ---------------------------------------
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomLetter() { return String.fromCharCode(65 + Math.floor(Math.random() * 26)); }
function randomLetterExcluding(exclude) {
  let code;
  do { code = 65 + Math.floor(Math.random() * 26); } while (String.fromCharCode(code) === exclude);
  return String.fromCharCode(code);
}

class Letter {
  constructor(char = randomLetter(), lane = randomInt(0, LANES - 1)) {
    this.char = char;
    this.speed = randomInt(letterSpeedMin, letterSpeedMax); // px/s, ramps with difficulty
    this.w = LETTER_SIZE;
    this.h = LETTER_SIZE;
    this.lane = lane;
    this.y = laneCenterY(this.lane) - this.h / 2;
    this.x = canvas.width; // start at right edge
  }

  update(dt) {
    this.x -= this.speed * dt;
  }

  isOffscreen() {
    return this.x + this.w < 0;
  }

  draw(ctx) {
    // black square with white letter centered
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.x, this.y, this.w, this.h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.char, this.x + this.w / 2, this.y + this.h / 2 + 0.5);
  }
}

/** @type {Letter[]} */
let letters = [];
let spawnTimer = 0;
let spawnInterval = 1.5; // seconds between spawns
let neededSafetyTimer = 0; // ensure needed letter at least every 2s

// Obstacles ---------------------------------------------------------------
const OBSTACLE_TYPES = /** @type {const} */(['trash','pothole','cone']);
// High-contrast colors so obstacles are clearly visible against the dark background
const OBSTACLE_COLORS = { trash: '#00ff7f', pothole: '#ff00ff', cone: '#ffd400' };
/** @type {{ trash: {w:number,h:number}, pothole:{w:number,h:number}, cone:{w:number,h:number} }} */
const OBSTACLE_SIZES = {
  trash: { w: 18, h: 18 },
  pothole: { w: 24, h: 8 },
  cone: { w: 12, h: 20 },
};

class Obstacle {
  /** @param {'trash'|'pothole'|'cone'} type @param {number} lane */
  constructor(type, lane) {
    this.type = type;
    this.lane = lane;
    const size = OBSTACLE_SIZES[type];
    this.w = size.w;
    this.h = size.h;
    // Pothole is flat on lane center; others centered vertically on lane
    const cy = laneCenterY(lane);
    this.y = cy - (type === 'pothole' ? this.h / 2 : this.h / 2);
    this.x = canvas.width;
    this.speed = randomInt(letterSpeedMin, letterSpeedMax);
  }

  update(dt) { this.x -= this.speed * dt; }
  isOffscreen() { return this.x + this.w < 0; }
  draw(ctx) {
    ctx.fillStyle = OBSTACLE_COLORS[this.type];
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // simple accents for readability
    if (this.type === 'trash') {
      ctx.fillStyle = '#2e3a1a';
      ctx.fillRect(this.x + 4, this.y + 4, this.w - 8, this.h - 8);
    } else if (this.type === 'cone') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 2, this.y + this.h - 6, this.w - 4, 3);
    } else if (this.type === 'pothole') {
      ctx.fillStyle = '#222222';
      ctx.fillRect(this.x + 2, this.y + this.h/2 - 1, this.w - 4, 2);
    }
    // outline (high contrast)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w, this.h);
  }
}

/** @type {Obstacle[]} */
let obstacles = [];
let obstacleSpawnTimer = 0;
let obstacleSpawnInterval = 2.0; // seconds (was 3.0)

let lastTime = 0;

function loop(ts) {
  const dt = Math.min(1, (ts - lastTime) / 1000);
  lastTime = ts;

  // Update - placeholder for future logic
  switch (state) {
    case GameState.START:
      // No game updates in start screen
      break;
    case GameState.RUN:
      // Timer
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        _setStateWrapper(GameState.OVER);
        break;
      }
      // Level-up banner timer
      if (levelUpTimer > 0) levelUpTimer = Math.max(0, levelUpTimer - dt);
  // Spawn letters on interval with weights and safety
      spawnTimer += dt;
      neededSafetyTimer += dt;
      while (spawnTimer >= spawnInterval) {
        // Count letters per lane to enforce caps
        const laneCounts = new Array(LANES).fill(0);
        for (const l of letters) laneCounts[l.lane]++;
        const availableLanes = [];
        for (let i = 0; i < LANES; i++) if (laneCounts[i] < MAX_PER_LANE) availableLanes.push(i);

        const nextNeededChar = targetWord[currentIndex] || randomLetter();
        const mustSpawnNeeded = neededSafetyTimer >= 2;
        const spawnNeeded = mustSpawnNeeded || Math.random() < 0.6;

        function chooseLane(avail) {
          if (avail.length === 0) return -1;
          return avail[Math.floor(Math.random() * avail.length)];
        }

        function spawnChar(ch) {
          const lane = chooseLane(availableLanes);
          if (lane === -1) return false;
          letters.push(new Letter(ch, lane));
          // update laneCounts and availableLanes
          laneCounts[lane]++;
          if (laneCounts[lane] >= MAX_PER_LANE) {
            const idx = availableLanes.indexOf(lane);
            if (idx !== -1) availableLanes.splice(idx, 1);
          }
          return true;
        }

        let spawnedNeeded = false;
        if (spawnNeeded) {
          spawnedNeeded = spawnChar(nextNeededChar);
          if (spawnedNeeded) neededSafetyTimer = 0;
        } else {
          // main spawn is a distractor
          const distractor = randomLetterExcluding(nextNeededChar);
          spawnChar(distractor);
        }

        // Optional extra distractors for pressure
        if (Math.random() < 0.3) {
          const d1 = randomLetterExcluding(nextNeededChar);
          spawnChar(d1);
          // 50% chance for a second extra distractor if space remains
          if (Math.random() < 0.5) {
            const d2 = randomLetterExcluding(nextNeededChar);
            spawnChar(d2);
          }
        }

        spawnTimer -= spawnInterval;
      }

      // Spawn obstacles independently
      obstacleSpawnTimer += dt;
      while (obstacleSpawnTimer >= obstacleSpawnInterval) {
        // Count per-lane caps for obstacles only (independent of letters)
        const laneCounts = new Array(LANES).fill(0);
        for (const o of obstacles) laneCounts[o.lane]++;
        const availableLanes = [];
        for (let i = 0; i < LANES; i++) if (laneCounts[i] < MAX_PER_LANE) availableLanes.push(i);
        if (availableLanes.length > 0) {
          const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
          const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
          obstacles.push(new Obstacle(type, lane));
        }
        obstacleSpawnTimer -= obstacleSpawnInterval;
      }
  // Update and cull letters
  for (let i = 0; i < letters.length; i++) letters[i].update(dt);
  if (letters.length) letters = letters.filter(l => !l.isOffscreen());
  // Update and cull obstacles (was missing update earlier)
  for (let i = 0; i < obstacles.length; i++) obstacles[i].update(dt);
  if (obstacles.length) obstacles = obstacles.filter(o => !o.isOffscreen());
  // Update floaters
  if (floaters.length) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y += f.vy * dt;
      f.life -= dt;
      f.alpha = Math.max(0, f.life / 1.0);
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

      // Player flash timer decay
      if (playerFlashTimer > 0) playerFlashTimer = Math.max(0, playerFlashTimer - dt);

      // Collision detection: simple AABB vs letter
      if (player) {
        const px = player.x, py = laneCenterY(player.lane) - player.h / 2;
        const pw = player.w, ph = player.h;
        for (let i = letters.length - 1; i >= 0; i--) {
          const l = letters[i];
          if (l.x < px + pw && l.x + l.w > px && l.y < py + ph && l.y + l.h > py) {
            // Overlap
            const needed = targetWord[currentIndex];
            if (l.char === needed) {
              // Correct letter: collect
              score += 100;
              timeLeft = Math.min(ROUND_TIME_START, timeLeft + 2);
              addFloater('+100', px + pw + 4, py, '#00ffcc');
              addFloater('+2s', px + pw + 4, py + 10, '#00ffcc');
              currentIndex += 1;
              letters.splice(i, 1);
              if (currentIndex >= targetWord.length) {
                // Word completed: small bonus and new word
                score += 500; // bonus
                // Increase difficulty for future letters
                letterSpeedMin += SPEED_INCREMENT;
                letterSpeedMax += SPEED_INCREMENT;
                wordsCompleted += 1;
                // Every 10 words => change city and bump difficulty
                if (wordsCompleted % 10 === 0) {
                  cityIndex = (cityIndex + 1) % CITIES.length;
                  // extra small bump per level
                  letterSpeedMin += SPEED_INCREMENT;
                  letterSpeedMax += SPEED_INCREMENT;
                  spawnInterval = Math.max(0.8, +(spawnInterval - 0.1).toFixed(2));
                  // reset spawn timers
                  spawnTimer = 0;
                  neededSafetyTimer = 0;
                  obstacleSpawnTimer = 0;
                  levelUpTimer = 2.0; // show banner 2s
                }
                targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
                currentIndex = 0;
              }
            } else {
              // Wrong letter: lose life and flash
              lives = Math.max(0, lives - 1);
              playerFlashTimer = PLAYER_FLASH_TIME;
              timeLeft = Math.max(0, timeLeft - 2);
              addFloater('-1 vie', px + pw + 4, py, '#ff6666');
              addFloater('-2s', px + pw + 4, py + 10, '#ff6666');
              letters.splice(i, 1);
              if (lives <= 0) {
                _setStateWrapper(GameState.OVER);
                break;
              }
            }
          }
        }
        // Collisions with obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          if (o.x < px + pw && o.x + o.w > px && o.y < py + ph && o.y + o.h > py) {
            lives = Math.max(0, lives - 1);
            playerFlashTimer = PLAYER_FLASH_TIME;
            timeLeft = Math.max(0, timeLeft - 2);
            addFloater('-1 vie', px + pw + 4, py, '#ff6666');
            addFloater('-2s', px + pw + 4, py + 10, '#ff6666');
            obstacles.splice(i, 1);
            if (lives <= 0) {
              _setStateWrapper(GameState.OVER);
              break;
            }
          }
        }
      }
      break;
    case GameState.OVER:
      // No updates on game over
      break;
  }

  // Render - clear canvas each frame
  const bg = (CITIES[cityIndex] && CITIES[cityIndex].bgColor) || CLEAR_COLOR;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Debug: state label
  if (DEBUG) {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`State: ${Object.keys(GameState)[state]}`, 6, 6);
    ctx.fillText(`dt: ${dt.toFixed(3)}s`, 6, 20);
  }

  // HUD layout
  if (state === GameState.RUN) {
    const margin = 6;
    // Top-left: Lives + Score
    const brooms = '🧹'.repeat(lives);
    ctx.fillStyle = HUD_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`Vies: ${brooms}`, margin, margin);
    ctx.font = '12px monospace';
    ctx.fillText(`Score: ${score}`, margin, margin + 14);

    // Top-center: title and slots
    const title = 'TROUVE LE MOT:';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(title, canvas.width / 2, margin);
    // Word slots below
    const SLOT_W = 12, SLOT_H = 14, SLOT_GAP = 2;
    const n = targetWord.length;
    const totalW = n * SLOT_W + (n - 1) * SLOT_GAP;
    let sx = Math.floor((canvas.width - totalW) / 2);
    const sy = margin + 16;
    for (let i = 0; i < n; i++) {
      const collected = i < currentIndex;
      // box
      ctx.fillStyle = collected ? '#ffffff' : '#2a3542';
      ctx.fillRect(sx, sy, SLOT_W, SLOT_H);
      // letter
      ctx.fillStyle = collected ? '#000000' : '#93a1b0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(targetWord[i] || '', sx + SLOT_W / 2, sy + SLOT_H / 2 + 0.5);
      sx += SLOT_W + SLOT_GAP;
    }

    // Top-right: Timer numeric
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '12px monospace';
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`${Math.ceil(timeLeft)}s`, canvas.width - margin, margin);

    // Bottom: City + Level centered
    const level = Math.floor(wordsCompleted / 10) + 1;
    const cityName = CITIES[cityIndex]?.name || '—';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '12px monospace';
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Ville: ${cityName} — Niveau ${level}`, canvas.width / 2, canvas.height - margin);
  }

  // Timer bar at the very top of the canvas
  if (state === GameState.RUN) {
    const pad = 0;
    const h = 4;
    const pct = Math.max(0, Math.min(1, timeLeft / ROUND_TIME_START));
    ctx.fillStyle = '#2a3542';
    ctx.fillRect(pad, pad, canvas.width - pad * 2, h);
    // Color thresholds: >20 green, 10–20 yellow, <10 red
    let col = '#00d18f';
    if (timeLeft <= 20 && timeLeft > 10) col = '#ffd400';
    else if (timeLeft <= 10) col = '#ff4444';
    ctx.fillStyle = col;
    ctx.fillRect(pad, pad, Math.floor((canvas.width - pad * 2) * pct), h);
  }

  // Draw lanes guides (subtle)
  if (state === GameState.RUN) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < LANES; i++) {
      const y = laneCenterY(i);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  // Draw letters first, then obstacles so obstacles appear on top
  if (state === GameState.RUN) {
    for (let i = 0; i < letters.length; i++) letters[i].draw(ctx);
    // ensure full opacity for obstacles
    ctx.globalAlpha = 1;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      o.draw(ctx);
      // Fallback debug visual if somehow transparent (shouldn't happen)
      // ctx.strokeStyle = '#00ffff';
      // ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w, o.h);
    }
  }

  // Draw player
  if (state === GameState.RUN && player) {
    if (playerFlashTimer > 0) {
      // draw flashing effect by alternating color overlay
      player.draw(ctx);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff4444';
      const cy = laneCenterY(player.lane);
      ctx.fillRect(player.x, cy - player.h / 2, player.w, player.h);
      ctx.globalAlpha = 1;
    } else {
      player.draw(ctx);
    }
  }

  // Debug overlay: draw obstacle bounding boxes and counters
  if (state === GameState.RUN && DEBUG) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w, o.h);
    }
    ctx.fillStyle = '#a0a6ad';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Letters: ${letters.length}  Obstacles: ${obstacles.length}`, 6, 78);
    if (obstacles.length > 0) {
      const o0 = obstacles[0];
      ctx.fillText(`Obs0 lane:${o0.lane} x:${o0.x.toFixed(1)} y:${o0.y.toFixed(1)} w:${o0.w} h:${o0.h} t:${o0.type}`, 6, 90);
    }
  }

  // Floating feedback texts on top
  if (state === GameState.RUN && floaters.length) {
    for (const f of floaters) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  // Level-up overlay: banner and border pulse
  if (state === GameState.RUN && levelUpTimer > 0) {
    // Banner
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, canvas.height/2 - 14, canvas.width, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cityName = CITIES[cityIndex]?.name || '';
    ctx.fillText(`LEVEL UP! Welcome to ${cityName}`, canvas.width/2, canvas.height/2);
    // Border pulse
    const t = 2 - levelUpTimer; // 0..2
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }

  requestAnimationFrame(loop);
}

// Initialize
setState(GameState.START);
requestAnimationFrame(loop);

// Export for debugging in console
window.GameState = GameState;
window.setState = setState;

// Input handling
window.addEventListener('keydown', (e) => {
  if (state !== GameState.RUN || !player) return;
  if (e.key === 'ArrowUp') {
    player.moveUp();
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    player.moveDown();
    e.preventDefault();
  }
});

// Mobile / pointer input: tap top/bottom halves of the canvas
canvas.addEventListener('pointerdown', (e) => {
  if (state !== GameState.RUN || !player) return;
  const rect = canvas.getBoundingClientRect();
  const yClient = e.clientY - rect.top;
  // map to canvas pixel space (height=180)
  const yCanvas = (yClient / rect.height) * canvas.height;
  if (yCanvas < canvas.height / 2) {
    player.moveUp();
  } else {
    player.moveDown();
  }
});

// Debug: force-spawn obstacle with key 'O'
window.addEventListener('keydown', (e) => {
  if (state !== GameState.RUN) return;
  if (e.key === 'o' || e.key === 'O') {
    const lane = Math.floor(Math.random() * LANES);
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push(new Obstacle(type, lane));
  }
});

// Ensure player exists and reset when entering RUN
const _origSetState = setState;
function _setStateWrapper(next) {
  _origSetState(next);
  if (next === GameState.RUN) {
    if (!player) player = new Player();
    player.reset();
    // Reset letters and spawn cycle
    letters = [];
    spawnTimer = 0;
    neededSafetyTimer = 0;
  obstacles = [];
  // Schedule an obstacle to spawn immediately on next frame
  obstacleSpawnTimer = obstacleSpawnInterval;
    // Reset HUD/gameplay stats
    score = 0;
    lives = 3;
    currentIndex = 0;
    targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    playerFlashTimer = 0;
    // Reset difficulty for new run
    letterSpeedMin = 60;
    letterSpeedMax = 80;
    // Reset timer
    timeLeft = ROUND_TIME_START;
    // Reset city/level progression and spawn pacing
    cityIndex = 0;
    wordsCompleted = 0;
    levelUpTimer = 0;
    spawnInterval = 1.5;
  }
  if (next === GameState.OVER) {
    // Update best score persistence
    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem('ss13_best', String(bestScore)); } catch {}
    }
    if (overFinal) overFinal.textContent = `Score: ${score}`;
    if (overBest) overBest.textContent = `Best: ${bestScore}`;
  }
}
// Replace exported setState and event handlers to use wrapper
window.setState = _setStateWrapper;
// Re-wire buttons to wrapper for consistency
startBtn.replaceWith(startBtn.cloneNode(true));
gameOverBtn.replaceWith(gameOverBtn.cloneNode(true));
restartBtn.replaceWith(restartBtn.cloneNode(true));
backBtn.replaceWith(backBtn.cloneNode(true));
// Re-query and attach listeners again
const _startBtn = document.getElementById('start-btn');
const _gameOverBtn = document.getElementById('gameover-btn');
const _restartBtn = document.getElementById('restart-btn');
const _backBtn = document.getElementById('back-btn');
_startBtn.addEventListener('click', () => _setStateWrapper(GameState.RUN));
_gameOverBtn.addEventListener('click', () => _setStateWrapper(GameState.OVER));
_restartBtn.addEventListener('click', () => _setStateWrapper(GameState.RUN));
_backBtn.addEventListener('click', () => _setStateWrapper(GameState.START));
