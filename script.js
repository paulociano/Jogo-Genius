const pads = [...document.querySelectorAll('.pad')];
const board = document.querySelector('#genius-board');
const startButton = document.querySelector('#start-button');
const resetButton = document.querySelector('#reset-button');
const soundToggle = document.querySelector('#sound-toggle');
const levelEl = document.querySelector('#level');
const bestScoreEl = document.querySelector('#best-score');
const statusEl = document.querySelector('#status');
const progressBar = document.querySelector('#progress-bar');
const coreNumber = document.querySelector('#core-number');

const PAD_COUNT = 9;
const FLASH_MS = 360;
const BETWEEN_FLASH_MS = 170;

let sequence = [];
let playerSequence = [];
let acceptingInput = false;
let gameStarted = false;
let soundEnabled = true;
let audioContext = null;
let playbackToken = 0;
let bestScore = Number(localStorage.getItem('genius-best-score') || 0);

const frequencies = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33];

bestScoreEl.textContent = bestScore;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function setStatus(message) {
  statusEl.textContent = message;
}

function setBoardEnabled(enabled) {
  acceptingInput = enabled;
  board.setAttribute('aria-disabled', String(!enabled));
  pads.forEach(pad => {
    pad.disabled = !enabled;
  });
}

function updateProgress() {
  const total = sequence.length || 1;
  const value = gameStarted ? (playerSequence.length / total) * 100 : 0;
  progressBar.style.width = `${Math.min(value, 100)}%`;
}

function updateScore() {
  levelEl.textContent = sequence.length;
  coreNumber.textContent = gameStarted ? sequence.length : PAD_COUNT;
}

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playTone(colorIndex, duration = 150) {
  const ctx = ensureAudio();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequencies[colorIndex];
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration / 1000 + 0.02);
}

async function flashPad(colorIndex, duration = FLASH_MS) {
  const pad = pads.find(item => Number(item.dataset.color) === colorIndex);
  if (!pad) return;
  pad.classList.add('selected');
  playTone(colorIndex, Math.min(duration, 220));
  await sleep(duration);
  pad.classList.remove('selected');
}

function randomColor() {
  return Math.floor(Math.random() * PAD_COUNT);
}

async function playSequence() {
  const token = ++playbackToken;
  setBoardEnabled(false);
  board.classList.add('is-watching');
  setStatus('Observe a sequência');
  progressBar.style.width = '0%';

  await sleep(450);

  for (const color of sequence) {
    if (token !== playbackToken || !gameStarted) return;
    await flashPad(color);
    await sleep(BETWEEN_FLASH_MS);
  }

  if (token !== playbackToken || !gameStarted) return;
  board.classList.remove('is-watching');
  playerSequence = [];
  updateProgress();
  setStatus('Sua vez');
  setBoardEnabled(true);
}

async function nextLevel() {
  sequence.push(randomColor());
  updateScore();
  await playSequence();
}

function saveBestScore() {
  const completedLevels = Math.max(sequence.length - 1, 0);
  if (completedLevels > bestScore) {
    bestScore = completedLevels;
    localStorage.setItem('genius-best-score', String(bestScore));
    bestScoreEl.textContent = bestScore;
    return true;
  }
  return false;
}

async function handleSuccess() {
  setBoardEnabled(false);
  progressBar.style.width = '100%';
  setStatus('Perfeito. Próximo nível!');
  await sleep(700);
  if (gameStarted) nextLevel();
}

async function gameOver() {
  setBoardEnabled(false);
  const wasRecord = saveBestScore();
  playbackToken++;
  board.classList.remove('is-watching');
  board.classList.add('is-error');
  setStatus(wasRecord ? 'Novo recorde! Tente de novo.' : 'Sequência incorreta. Tente novamente.');
  playTone(8, 420);

  await sleep(420);
  board.classList.remove('is-error');
  startButton.textContent = 'Jogar novamente';
  startButton.disabled = false;
  gameStarted = false;
  resetButton.disabled = true;
}

async function handlePadInput(colorIndex) {
  if (!acceptingInput || !gameStarted) return;

  const currentIndex = playerSequence.length;
  playerSequence.push(colorIndex);
  updateProgress();
  await flashPad(colorIndex, 150);

  if (colorIndex !== sequence[currentIndex]) {
    gameOver();
    return;
  }

  if (playerSequence.length === sequence.length) {
    handleSuccess();
  }
}

function resetGameState() {
  playbackToken++;
  sequence = [];
  playerSequence = [];
  gameStarted = false;
  setBoardEnabled(false);
  board.classList.remove('is-watching', 'is-error');
  updateScore();
  updateProgress();
}

function startGame() {
  ensureAudio();
  resetGameState();
  gameStarted = true;
  startButton.disabled = true;
  startButton.textContent = 'Em jogo';
  resetButton.disabled = false;
  setStatus('Preparando primeira sequência');
  nextLevel();
}

function restartGame() {
  resetGameState();
  startButton.disabled = false;
  startButton.textContent = 'Começar jogo';
  resetButton.disabled = true;
  setStatus('Pronto para jogar');
}

pads.forEach(pad => {
  pad.addEventListener('click', () => handlePadInput(Number(pad.dataset.color)));
});

startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', restartGame);

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Desativar sons' : 'Ativar sons');
  soundToggle.querySelector('span:first-child').textContent = soundEnabled ? '♪' : '×';
  if (soundEnabled) playTone(0, 100);
});

document.addEventListener('keydown', event => {
  if (event.repeat) return;

  if (event.key === 'Enter' && !gameStarted && !startButton.disabled) {
    startGame();
    return;
  }

  const numeric = Number(event.key);
  if (numeric >= 1 && numeric <= 9) {
    const pad = pads[numeric - 1];
    if (pad) handlePadInput(Number(pad.dataset.color));
  }
});

restartGame();