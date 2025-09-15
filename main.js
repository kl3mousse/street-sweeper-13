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
      // Update entities here later
      break;
    case GameState.OVER:
      // No updates on game over
      break;
  }

  // Render - clear canvas each frame
  ctx.fillStyle = CLEAR_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw state label for clarity
  ctx.fillStyle = '#eaeaea';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`State: ${Object.keys(GameState)[state]}`, 6, 6);
  ctx.fillText(`dt: ${dt.toFixed(3)}s`, 6, 20);

  requestAnimationFrame(loop);
}

// Initialize
setState(GameState.START);
requestAnimationFrame(loop);

// Export for debugging in console
window.GameState = GameState;
window.setState = setState;
