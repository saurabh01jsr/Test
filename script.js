const MODES = {
  pomodoro: { label: "Focus", duration: 25 * 60 },
  short: { label: "Pause", duration: 5 * 60 },
  long: { label: "Restore", duration: 15 * 60 }
};

const state = {
  mode: "pomodoro",
  remaining: MODES.pomodoro.duration,
  isRunning: false,
  targetTime: null,
  rafId: null,
  focusRound: 1
};

const timeDisplay = document.getElementById("time-display");
const startStopBtn = document.getElementById("start-stop");
const resetBtn = document.getElementById("reset");
const modeButtons = Array.from(document.querySelectorAll(".mode-button"));
const cycleCountEl = document.getElementById("cycle-count");
const modeLabelEl = document.getElementById("mode-label");
const nextLabelEl = document.getElementById("next-label");
const progressRing = document.querySelector(".progress__ring-indicator");

const RADIUS = 148;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
progressRing.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
progressRing.style.strokeDashoffset = 0;
progressRing.style.transition = "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)";

let audioCtx;

function ensureAudioContext(fromInteraction = false) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (fromInteraction && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateProgress(remainingSeconds) {
  const duration = MODES[state.mode].duration;
  const safeRemaining = Math.max(0, Math.min(duration, remainingSeconds));
  const progress = 1 - safeRemaining / duration;
  progressRing.style.strokeDashoffset = CIRCUMFERENCE * progress;
}

function updateUI(fractionalRemaining) {
  const secondsLeft =
    typeof fractionalRemaining === "number"
      ? Math.max(0, fractionalRemaining)
      : state.remaining;
  const displaySeconds = Math.ceil(secondsLeft);
  timeDisplay.textContent = formatTime(displaySeconds);
  document.title = `${MODES[state.mode].label} • ${formatTime(displaySeconds)} — Focus Flow`;
  updateProgress(secondsLeft);
  cycleCountEl.textContent = `Focus ${state.focusRound} of 4`;
  modeLabelEl.textContent = MODES[state.mode].label;
  nextLabelEl.textContent = getNextLabel();
}

function getNextLabel() {
  if (state.mode === "pomodoro") {
    return state.focusRound === 4 ? MODES.long.label : MODES.short.label;
  }
  return MODES.pomodoro.label;
}

function cancelTimer() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setRingTransition(active) {
  progressRing.style.transition = active
    ? "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)"
    : "none";
}

function pauseTimer() {
  if (!state.isRunning) return;
  state.isRunning = false;
  cancelTimer();
  if (state.targetTime) {
    const remaining = Math.max(0, (state.targetTime - Date.now()) / 1000);
    state.remaining = Math.ceil(remaining);
  }
  state.targetTime = null;
  startStopBtn.textContent = "Resume";
  setRingTransition(true);
  updateUI();
}

function startTimer() {
  if (state.isRunning) {
    pauseTimer();
    return;
  }
  state.isRunning = true;
  const now = Date.now();
  state.targetTime = now + state.remaining * 1000;
  startStopBtn.textContent = "Pause";
  setRingTransition(false);
  step();
}

function step() {
  if (!state.isRunning || !state.targetTime) return;
  const remaining = (state.targetTime - Date.now()) / 1000;
  if (remaining <= 0) {
    state.remaining = 0;
    updateUI(0);
    completeSession();
    return;
  }
  state.remaining = Math.ceil(remaining);
  updateUI(remaining);
  state.rafId = requestAnimationFrame(step);
}

function setMode(mode) {
  cancelTimer();
  state.mode = mode;
  state.remaining = MODES[mode].duration;
  state.targetTime = null;
  state.isRunning = false;
  startStopBtn.textContent = "Start";
  updateModeButtons();
  setRingTransition(true);
  updateUI();
}

function resetTimer() {
  state.focusRound = 1;
  setMode("pomodoro");
}

function playChime() {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const duration = 1.2;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.warn("Chime unavailable", error);
  }
}

function completeSession() {
  playChime();
  if (state.mode === "pomodoro") {
    if (state.focusRound === 4) {
      state.focusRound = 1;
      setMode("long");
    } else {
      state.focusRound += 1;
      setMode("short");
    }
  } else {
    setMode("pomodoro");
  }
}

startStopBtn.addEventListener("click", () => {
  ensureAudioContext(true);
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener("click", () => {
  resetTimer();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === state.mode) return;
    cancelTimer();
    state.mode = mode;
    state.remaining = MODES[mode].duration;
    state.targetTime = null;
    state.isRunning = false;
    startStopBtn.textContent = "Start";
    updateModeButtons();
    updateUI();
  });
});

setRingTransition(true);
updateUI();
