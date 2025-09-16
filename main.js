// Street Sweeper 13 - minimal game loop and state machine

/** @enum {number} */
const GameState = {
  START: 0,
  RUN: 1,
  OVER: 2,
};
 
let state = GameState.START;

// Canvas and context
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// UI elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const overScreen = document.getElementById('over-screen');
const overFinal = document.getElementById('over-final');
const overBest = document.getElementById('over-best');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const backBtn = document.getElementById('back-btn');

function setState(next) {
  state = next;
  // Toggle screens
  startScreen.classList.toggle('hidden', state !== GameState.START);
  gameScreen.classList.toggle('hidden', state !== GameState.RUN);
  overScreen.classList.toggle('hidden', state !== GameState.OVER);
}

if (startBtn) startBtn.addEventListener('click', () => setState(GameState.RUN));
if (restartBtn) restartBtn.addEventListener('click', () => setState(GameState.RUN));
if (backBtn) backBtn.addEventListener('click', () => setState(GameState.START));

// HUD colors and debug flags
const CLEAR_COLOR = '#101820'; // deep navy
const HUD_COLOR = '#eaeaea';
const DEBUG = false; // set to true to show debug overlays
// Separate toggle to show collision boxes at runtime (press 'H')
let SHOW_HITBOXES = false;

// Scrolling street background (pixel art)
const streetImg = new Image();
streetImg.src = 'assets/street.png';
let streetLoaded = false;
streetImg.onload = () => { streetLoaded = true; };
let streetScrollX = 0; // pixels, increasing moves background left

// Foreground sidewalk/city layer (e.g., Marseille), scrolls same as street
const marseilleImg = new Image();
marseilleImg.src = 'assets/marseille.png';
let marseilleLoaded = false;
marseilleImg.onload = () => { marseilleLoaded = true; };

// Lanes and player config
const LANES = 3;
const PLAYER_X = 40; // fixed left-side x
const PLAYER_W = 32; // collision width
const PLAYER_H = 18; // collision height
// Visual draw size (bigger than collision for nicer look)
const PLAYER_DRAW_W = 64;
const PLAYER_DRAW_H = 64;
// Vertical anchor: bottom of sprite (and collision box) sits slightly below the lane center
const PLAYER_FOOT_OFFSET = 10; // px below lane line
const PLAYER_COLOR = '#00d18f';
const LETTER_SIZE = 18;
const MAX_PER_LANE = 2;

// Player sprite (2-frame spritesheet, 64x64 per frame)
const PLAYER_SPRITE_SRC = 'assets/player.png'; // place your attached PNG here
const PLAYER_FRAME_W = 64;
const PLAYER_FRAME_H = 64;
const PLAYER_FRAME_COUNT = 2;
const PLAYER_FRAME_DURATION = 0.2; // seconds per frame
const playerImg = new Image();
playerImg.src = PLAYER_SPRITE_SRC;
let playerImgLoaded = false;
playerImg.onload = () => { playerImgLoaded = true; };

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
// Shared background/obstacle scroll speed (px/s), computed each frame
let currentStreetSpeed = 0;

// Timer / scoring persistence
const ROUND_TIME_START = 45; // seconds
let timeLeft = ROUND_TIME_START;
// Guard localStorage access for environments where it's blocked (e.g., file:// on some Android Chrome setups)
let bestScore = 0;
try {
  const stored = localStorage.getItem('ss13_best');
  bestScore = Number(stored || '0');
  if (!Number.isFinite(bestScore)) bestScore = 0;
} catch {
  bestScore = 0;
}
// Time bonuses
const WORD_COMPLETE_TIME_BONUS = 6; // seconds gained when completing a word
const LEVEL_UP_TIME_BONUS = 10; // additional seconds gained when leveling up
// Cities / levels ----------------------------------------------------------
const CITIES = [
  { name: 'Marseille', bgColor: '#4477aa' },
  { name: 'Paris', bgColor: '#888888' },
  { name: 'Tokyo', bgColor: '#aa4477' },
  { name: 'New York', bgColor: '#ffaa44' },
];
let cityIndex = 0; // index into CITIES
let wordsCompleted = 0; // total words completed this run
let levelUpTimer = 0; // seconds remaining for level-up overlay (separate from scrolling banner)
// Scrolling level banner that appears at level start and level-up
/** @type {{text:string,x:number,y:number,active:boolean} | null} */
let levelBanner = null;
function triggerLevelBanner() {
  const level = Math.floor(wordsCompleted / 10) + 1;
  const cityName = CITIES[cityIndex]?.name || '';
  const text = `Level ${level}: ${cityName}`;
  // Start to the right of the canvas and scroll left; draw near bottom with a small margin
  const margin = 6;
  levelBanner = { text, x: canvas.width + 10, y: canvas.height - margin, active: true };
}
// Floating feedback texts
/** @type {{text:string,x:number,y:number,alpha:number,vy:number,color:string,life:number}[]} */
let floaters = [];
function addFloater(text, x, y, color = '#ffffff') {
  floaters.push({ text, x, y, alpha: 1, vy: -24, color, life: 1.0 }); // ~1s life
}

// Word completion phases (pause gameplay): celebrate -> focus -> resume
const WORD_CELEBRATE_TIME = 2.2; // seconds
const WORD_FOCUS_TIME = 1.2; // seconds
/** @type {'none'|'celebrate'|'focus'} */
let wordPhase = 'none';
let wordPhaseTimer = 0; // seconds remaining in current phase
let lastCompletedWord = '';
let nextWordPending = '';

/**
 * Compute the center Y for a lane index [0..LANES-1]
 * Evenly spaces lanes across the canvas height (centers at 1/(L+1), ..., L/(L+1)).
 */
function laneCenterY(idx) {
  // Custom lane positions:
  // Top:   5/8 from bottom -> 3/8 from top
  // Middle:3/8 from bottom -> 5/8 from top
  // Bottom:1/8 from bottom -> 7/8 from top
  // For idx = 0,1,2 => fractions 3/8, 5/8, 7/8 of canvas height
  const fractionFromTop = (3 + 2 * idx) / 8; // 0.375, 0.625, 0.875
  return Math.round(canvas.height * fractionFromTop);
}

class Player {
  constructor() {
    this.x = PLAYER_X; // left edge
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.lane = 1; // start in middle lane [0,1,2]
    // animation state
    this.frame = 0;
    this.animTime = 0; // accumulates dt
  }

  reset() {
    this.lane = 1;
    this.frame = 0;
    this.animTime = 0;
  }

  /** Collision rectangle: bottom aligned to lane center + offset (near wheels). */
  getCollisionRect() {
    const bottomY = laneCenterY(this.lane) + PLAYER_FOOT_OFFSET;
    const x = this.x;
    const y = bottomY - this.h;
    return { x, y, w: this.w, h: this.h };
  }

  /** Draw rectangle: bottom aligned to same lane anchor as collision, centered horizontally on hitbox. */
  getDrawRect() {
    const { x: baseX } = this.getCollisionRect();
    const bottomY = laneCenterY(this.lane) + PLAYER_FOOT_OFFSET;
    const dw = PLAYER_DRAW_W;
    const dh = PLAYER_DRAW_H;
    return {
      x: baseX + (this.w - dw) / 2,
      y: bottomY - dh,
      w: dw,
      h: dh,
    };
  }

  moveUp() {
    if (this.lane > 0) this.lane -= 1;
  }

  moveDown() {
    if (this.lane < LANES - 1) this.lane += 1;
  }

  update(dt) {
    // advance walking/rolling animation
    this.animTime += dt;
    while (this.animTime >= PLAYER_FRAME_DURATION) {
      this.animTime -= PLAYER_FRAME_DURATION;
      this.frame = (this.frame + 1) % PLAYER_FRAME_COUNT;
    }
  }

  draw(ctx) {
    const { x, y, w, h } = this.getDrawRect();

    if (playerImgLoaded) {
      // Source rectangle for current frame
      const sx = this.frame * PLAYER_FRAME_W;
      const sy = 0;
      const sw = PLAYER_FRAME_W;
      const sh = PLAYER_FRAME_H;
      // Draw scaled down to 18x18 keeping pixel crispness
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(playerImg, sx, sy, sw, sh, x, y, w, h);
      ctx.imageSmoothingEnabled = prevSmoothing;
    } else {
      // Fallback: placeholder rect until image loads
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fillRect(x, y, w, h);
    }
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
let spawnInterval = 1.7; // seconds between spawns
let neededSafetyTimer = 0; // ensure needed letter at least every 2s

// Obstacles ---------------------------------------------------------------
const OBSTACLE_TYPES = /** @type {const} */(['trash','pothole','cone']); // kept for spawn variety, not used for size

// Obstacle sprite sheet (Marseille) — 5 frames, 32x32 each
const OBST_SHEET_SRC = 'assets/marseille-obstacles.png';
const obstacleImg = new Image();
obstacleImg.src = OBST_SHEET_SRC;
let obstacleImgLoaded = false;
obstacleImg.onload = () => { obstacleImgLoaded = true; };
const OBST_SPRITE_W = 32;
const OBST_SPRITE_H = 32;
const OBST_SPRITE_COUNT = 5;
// Unified hitbox: 16x24, centered horizontally, bottom-aligned to lane
const OBST_HIT_W = 16;
const OBST_HIT_H = 24;
const OBST_FOOT_OFFSET = PLAYER_FOOT_OFFSET; // align to same ground line as player

class Obstacle {
  /** @param {'trash'|'pothole'|'cone'} type @param {number} lane */
  constructor(type, lane) {
    this.type = type;
    this.lane = lane;
    // Hitbox dimensions (collision)
    this.w = OBST_HIT_W;
    this.h = OBST_HIT_H;
    // Vertical position: bottom aligned to lane center + offset
    const bottomY = laneCenterY(lane) + OBST_FOOT_OFFSET;
    this.y = bottomY - this.h;
    this.x = canvas.width;
    this.speed = randomInt(letterSpeedMin, letterSpeedMax);
    // Choose a random sprite frame [0..4]
    this.frame = Math.floor(Math.random() * OBST_SPRITE_COUNT);
  }

  update(dt) {
    // Move at the exact same speed as the street background for perfect sync
    this.x -= currentStreetSpeed * dt;
  }
  isOffscreen() {
    // Consider sprite width and centering so we don't cull while still visible
    const dw = OBST_SPRITE_W;
    const dx = this.x + (this.w - dw) / 2;
    return dx + dw < 0;
  }
  draw(ctx) {
    if (obstacleImgLoaded) {
      const sx = (this.frame % OBST_SPRITE_COUNT) * OBST_SPRITE_W;
      const sy = 0;
      const sw = OBST_SPRITE_W;
      const sh = OBST_SPRITE_H;
      // Draw rect bottom-aligned to lane, centered on hitbox
      const dw = OBST_SPRITE_W;
      const dh = OBST_SPRITE_H;
      const dx = this.x + (this.w - dw) / 2;
      const dy = (this.y + this.h) - dh; // bottom align sprite to collision bottom
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(obstacleImg, sx, sy, sw, sh, Math.round(dx), Math.round(dy), dw, dh);
      ctx.imageSmoothingEnabled = prev;
    } else {
      // Fallback: simple placeholder until sprite loads
      ctx.fillStyle = '#8888ff';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

/** @type {Obstacle[]} */
let obstacles = [];
let obstacleSpawnTimer = 0;
// Base obstacle spawn pacing is now level-scaled (computed each frame); this is an initial value only
let obstacleSpawnInterval = 4.2; // seconds at init; Level 1 will override to ~4.0s
// Obstacle-only per-lane cap to reduce stacked hazards on the same lane
const OBST_MAX_PER_LANE = 1;
// Global cap to avoid overcrowding (fits 3 lanes well)
const OBST_MAX_TOTAL = 2;

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
      // Handle word-completion pause phases early (freeze gameplay while active)
      if (wordPhase !== 'none') {
        const dur = wordPhase === 'celebrate' ? WORD_CELEBRATE_TIME : WORD_FOCUS_TIME;
        wordPhaseTimer = Math.max(0, wordPhaseTimer - dt);
        if (wordPhaseTimer === 0) {
          if (wordPhase === 'celebrate') {
            // Switch to focus phase and reveal the new target word
            if (!nextWordPending) nextWordPending = WORDS[Math.floor(Math.random() * WORDS.length)];
            targetWord = nextWordPending;
            currentIndex = 0;
            nextWordPending = '';
            wordPhase = 'focus';
            wordPhaseTimer = WORD_FOCUS_TIME;
          } else {
            // End focus phase, resume gameplay
            wordPhase = 'none';
          }
        }
        // Skip the rest of RUN updates while paused
        break;
      }
      // Timer (frozen during wordPhase)
      if (wordPhase === 'none') timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        _setStateWrapper(GameState.OVER);
        break;
      }
      // Level-up banner timer
      if (levelUpTimer > 0) levelUpTimer = Math.max(0, levelUpTimer - dt);
  // Spawn letters on interval with weights and safety
      if (wordPhase === 'none') {
        spawnTimer += dt;
        neededSafetyTimer += dt;
      }
      // Spawn at most one letter per interval to avoid unfair simultaneous walls
      if (spawnTimer >= spawnInterval) {
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

        spawnTimer -= spawnInterval;
      }

      // Spawn obstacles independently (frozen during wordPhase)
      // Scale obstacle spawn interval by level: easier early, slightly faster later (min 2.4s)
      {
        const level = Math.floor(wordsCompleted / 10) + 1; // 1-based level
        const desired = Math.max(2.4, 4.0 - 0.25 * (level - 1));
        obstacleSpawnInterval = desired;
      }
      if (wordPhase === 'none') obstacleSpawnTimer += dt;
      // At most one obstacle per interval
      if (obstacleSpawnTimer >= obstacleSpawnInterval) {
        // Count per-lane caps for obstacles only (independent of letters)
        const laneCounts = new Array(LANES).fill(0);
        for (const o of obstacles) laneCounts[o.lane]++;
        const availableLanes = [];
        for (let i = 0; i < LANES; i++) if (laneCounts[i] < OBST_MAX_PER_LANE) availableLanes.push(i);
        if (availableLanes.length > 0 && obstacles.length < OBST_MAX_TOTAL) {
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
  if (floaters.length && wordPhase === 'none') {
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

  // Player animation update
  if (player && wordPhase === 'none') player.update(dt);

      // Compute shared street speed once per frame and use it for background and obstacles
  currentStreetSpeed = (wordPhase === 'none') ? Math.max(24, Math.min(120, letterSpeedMin * 0.6)) : 0; // px/s
      // Update street scroll with the same speed
      if (streetLoaded || marseilleLoaded) {
        const wrap = (streetImg.width || marseilleImg.width || 320);
        streetScrollX = (streetScrollX + currentStreetSpeed * dt) % wrap;
      }

      // Update scrolling level banner position
      if (levelBanner && levelBanner.active) {
        levelBanner.x -= currentStreetSpeed * dt;
      }

      // Collision detection: simple AABB vs letter
      if (player) {
        const { x: px, y: py, w: pw, h: ph } = player.getCollisionRect();
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
                // Time bonus on word completion
                timeLeft = Math.min(ROUND_TIME_START, timeLeft + WORD_COMPLETE_TIME_BONUS);
                if (player) {
                  const { x: px, y: py, w: pw } = player.getCollisionRect();
                  addFloater(`+${WORD_COMPLETE_TIME_BONUS}s`, px + pw + 4, py + 20, '#00ffcc');
                }
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
                  obstacleSpawnTimer = 0; // interval will be recomputed each frame based on level
                  levelUpTimer = 2.0; // show banner 2s
                  // Time bonus on level-up
                  timeLeft = Math.min(ROUND_TIME_START, timeLeft + LEVEL_UP_TIME_BONUS);
                  if (player) {
                    const { x: px, y: py, w: pw } = player.getCollisionRect();
                    addFloater(`+${LEVEL_UP_TIME_BONUS}s`, px + pw + 4, py + 30, '#ffd400');
                  }
                  // Trigger scrolling level banner for new level
                  triggerLevelBanner();
                } else {
                  // Not a level-up, still show city & score scroll on word completion
                  triggerLevelBanner();
                }
                // Start celebration/focus pause sequence
                lastCompletedWord = targetWord;
                nextWordPending = WORDS[Math.floor(Math.random() * WORDS.length)];
                wordPhase = 'celebrate';
                wordPhaseTimer = WORD_CELEBRATE_TIME;
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

  // Draw scrolling street background aligned to bottom
  if (state === GameState.RUN && streetLoaded) {
    const y = canvas.height - streetImg.height; // bottom align
    const w = streetImg.width;
    const h = streetImg.height;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // Start drawing from negative offset so that the image appears shifted by streetScrollX
    let startX = -streetScrollX;
    // Draw enough tiles to cover the entire canvas width
    for (let x = startX; x < canvas.width; x += w) {
      ctx.drawImage(streetImg, 0, 0, w, h, Math.round(x), y, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  // Draw Marseille layer above street, bottom aligned to 12px above the upper lane
  if (state === GameState.RUN && marseilleLoaded) {
    const bottomAnchor = laneCenterY(0) - 12; // 12px above upper lane
    const w = marseilleImg.width;
    const h = marseilleImg.height;
    const y = bottomAnchor - h;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    let startX = -streetScrollX;
    for (let x = startX; x < canvas.width; x += w) {
      ctx.drawImage(marseilleImg, 0, 0, w, h, Math.round(x), y, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  // Debug: state label
  if (DEBUG) {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`State: ${Object.keys(GameState)[state]}`, 6, 6);
    ctx.fillText(`dt: ${dt.toFixed(3)}s`, 6, 20);
  }

  // HUD layout: Single-row top bar + word slots
  if (state === GameState.RUN) {
    const margin = 6;
    const BAR_H = 18;
    // Top translucent bar background for contrast on light city backgrounds
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, canvas.width, BAR_H);

    // Lives (left) and Score (right)
    const brooms = '🧹'.repeat(lives);
    ctx.fillStyle = HUD_COLOR;
    ctx.textBaseline = 'middle';
    ctx.font = '12px monospace';
    const yMid = Math.floor(BAR_H / 2);
    // Lives left
    ctx.textAlign = 'left';
    ctx.fillText(brooms, margin, yMid);
    // Score right
    ctx.textAlign = 'right';
    ctx.fillText(String(score), canvas.width - margin, yMid);

    // Word slots below the bar (no title text to save space)
    const SLOT_W = 12, SLOT_H = 14, SLOT_GAP = 2;
    const n = targetWord.length;
    const totalW = n * SLOT_W + (n - 1) * SLOT_GAP;
    let sx = Math.floor((canvas.width - totalW) / 2);
    const sy = BAR_H + 4;
    for (let i = 0; i < n; i++) {
      const collected = i < currentIndex;
      ctx.fillStyle = collected ? '#ffffff' : '#2a3542';
      ctx.fillRect(sx, sy, SLOT_W, SLOT_H);
      ctx.fillStyle = collected ? '#000000' : '#93a1b0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(targetWord[i] || '', sx + SLOT_W / 2, sy + SLOT_H / 2 + 0.5);
      sx += SLOT_W + SLOT_GAP;
    }
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

  // Scrolling level banner: appears at level start, on level-up, and on word completion.
  // Draw it late so it appears above gameplay and overlays.
  if (state === GameState.RUN && levelBanner && levelBanner.active) {
    const margin = 6;
    const text = levelBanner.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '12px monospace';
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width) + 12; // padding
    const h = 16;
    const x = Math.round(levelBanner.x);
    const y = levelBanner.y;
    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 6, y - h + 2, w, h);
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6 + 0.5, y - h + 2 + 0.5, w, h);
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    // Deactivate once fully off-screen
    if (x + w < 0) {
      levelBanner.active = false;
    }
  }

  // Lane guides removed for cleaner visuals

  // Draw letters first, then obstacles so obstacles appear on top
  if (state === GameState.RUN && wordPhase === 'none') {
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
  if (state === GameState.RUN && player && wordPhase === 'none') {
    if (playerFlashTimer > 0) {
      // draw flashing effect by alternating color overlay
      player.draw(ctx);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff4444';
      const dr = player.getDrawRect();
      ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
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

  // Collision boxes overlay (toggle with 'H')
  if (state === GameState.RUN && SHOW_HITBOXES) {
    ctx.globalAlpha = 1;
    // Letters
    ctx.strokeStyle = 'rgba(0,255,255,0.9)';
    ctx.lineWidth = 1;
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      ctx.strokeRect(l.x + 0.5, l.y + 0.5, l.w, l.h);
    }
    // Obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w, o.h);
    }
    // Player collision rect
    if (player) {
      const { x: px, y: py, w: pw, h: ph } = player.getCollisionRect();
      ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
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

  // Word celebration/focus overlays
  if (state === GameState.RUN && wordPhase !== 'none') {
    // Dim the scene slightly
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (wordPhase === 'celebrate') {
      // Big celebratory word with pulse/scale effect
      const t = (WORD_CELEBRATE_TIME - wordPhaseTimer);
      const scale = 1 + 0.1 * Math.sin(t * 8);
      ctx.save();
      ctx.translate(canvas.width/2, canvas.height/2 - 6);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`${lastCompletedWord} 👍!`, 0, 0);
      ctx.restore();
      // Bonus hint below
      ctx.fillStyle = '#ffd400';
      ctx.font = '12px monospace';
      ctx.fillText('+500 bonus', canvas.width/2, canvas.height/2 + 16);
    } else if (wordPhase === 'focus') {
      // Focus on the new word: show target with an underline animation
      const t = (WORD_FOCUS_TIME - wordPhaseTimer);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`🆕♻️ ${targetWord} ♻️🆕`, canvas.width/2, canvas.height/2);
      // Underline grows from center
      const total = Math.min(canvas.width - 40, 12 * targetWord.length + 8);
      const half = (total / 2) * Math.min(1, t / WORD_FOCUS_TIME);
      const y = canvas.height/2 + 6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width/2 - half, y);
      ctx.lineTo(canvas.width/2 + half, y);
      ctx.stroke();
    }
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
  if (state !== GameState.RUN || !player || wordPhase !== 'none') return;
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
  if (state !== GameState.RUN || !player || wordPhase !== 'none') return;
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
  // Start obstacle timer fresh; first obstacle will spawn after the first interval
  obstacleSpawnTimer = 0;
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
    // Trigger banner for level start
    levelBanner = null;
    triggerLevelBanner();
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
restartBtn.replaceWith(restartBtn.cloneNode(true));
backBtn.replaceWith(backBtn.cloneNode(true));
// Re-query and attach listeners again
const _startBtn = document.getElementById('start-btn');
const _restartBtn = document.getElementById('restart-btn');
const _backBtn = document.getElementById('back-btn');
_startBtn.addEventListener('click', () => _setStateWrapper(GameState.RUN));
_restartBtn.addEventListener('click', () => _setStateWrapper(GameState.RUN));
_backBtn.addEventListener('click', () => _setStateWrapper(GameState.START));

// Global debug hotkey: toggle collision boxes with 'H'
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    SHOW_HITBOXES = !SHOW_HITBOXES;
    e.preventDefault();
  }
});
