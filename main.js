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

// Lanes and player config
const LANES = 3;
const PLAYER_X = 40; // fixed left-side x
const PLAYER_W = 18;
const PLAYER_H = 18;
const PLAYER_COLOR = '#00d18f';
const LETTER_SIZE = 18;

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

class Letter {
  constructor() {
    this.char = randomLetter();
    this.speed = randomInt(60, 80); // px/s
    this.w = LETTER_SIZE;
    this.h = LETTER_SIZE;
    this.lane = randomInt(0, LANES - 1);
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
      // Spawn letters on interval
      spawnTimer += dt;
      while (spawnTimer >= spawnInterval) {
        letters.push(new Letter());
        spawnTimer -= spawnInterval;
      }
      // Update and cull letters
      for (let i = 0; i < letters.length; i++) letters[i].update(dt);
      if (letters.length) letters = letters.filter(l => !l.isOffscreen());
      break;
    case GameState.OVER:
      // No updates on game over
      break;
  }

  // Render - clear canvas each frame
  ctx.fillStyle = CLEAR_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw state label for clarity
  ctx.fillStyle = HUD_COLOR;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`State: ${Object.keys(GameState)[state]}`, 6, 6);
  ctx.fillText(`dt: ${dt.toFixed(3)}s`, 6, 20);

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

  // Draw letters
  if (state === GameState.RUN) {
    for (let i = 0; i < letters.length; i++) letters[i].draw(ctx);
  }

  // Draw player
  if (state === GameState.RUN && player) {
    player.draw(ctx);
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
