const focusLengthInput = document.getElementById("focus-length");
const breakLengthInput = document.getElementById("break-length");
const cycleCountInput = document.getElementById("cycle-count");

const minuteEl = document.querySelector(".timer-card__minutes");
const secondsEl = document.querySelector(".timer-card__seconds");
const indicatorEl = document.querySelector(".timer-card__indicator");
const modeButtons = document.querySelectorAll(".mode-switch__option");
const startButton = document.querySelector('[data-action="start"]');
const pauseButton = document.querySelector('[data-action="pause"]');
const resetButton = document.querySelector('[data-action="reset"]');
const cycleDots = Array.from(document.querySelectorAll(".cycle-indicator__dot"));
const toastTemplate = document.getElementById("toast-template");

const settings = {
  focus: Number(focusLengthInput.value) * 60,
  break: Number(breakLengthInput.value) * 60,
  cycles: Number(cycleCountInput.value),
};

const state = {
  mode: "focus",
  isRunning: false,
  remainingTime: settings.focus,
  currentCycle: 1,
  intervalId: null,
};

const formatNumber = (value) => String(value).padStart(2, "0");

const updateClock = () => {
  const minutes = Math.floor(state.remainingTime / 60);
  const seconds = state.remainingTime % 60;
  minuteEl.textContent = formatNumber(minutes);
  secondsEl.textContent = formatNumber(seconds);
};

const updateProgress = () => {
  const duration = settings[state.mode];
  const circumference = 2 * Math.PI * 200; // r = 200
  const progress = ((duration - state.remainingTime) / duration) * circumference;
  indicatorEl.style.strokeDasharray = `${progress} ${circumference}`;
};

const updateControls = () => {
  if (state.isRunning) {
    startButton.disabled = true;
    pauseButton.disabled = false;
    resetButton.disabled = false;
  } else {
    startButton.disabled = false;
    pauseButton.disabled = true;
    resetButton.disabled = state.remainingTime === settings[state.mode];
  }
};

const setActiveModeButton = () => {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive);
    button.setAttribute("tabindex", isActive ? "0" : "-1");
  });
};

const updateCycleDots = () => {
  cycleDots.forEach((dot, index) => {
    const isActive = index === state.currentCycle - 1;
    const isHidden = index >= settings.cycles;
    dot.classList.toggle("cycle-indicator__dot--active", isActive && !isHidden);
    dot.classList.toggle("cycle-indicator__dot--hidden", isHidden);
  });
};

const showToast = (message) => {
  const fragment = toastTemplate.content.cloneNode(true);
  const toast = fragment.querySelector(".toast");
  const text = fragment.querySelector(".toast__message");
  text.textContent = message;
  document.body.appendChild(fragment);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.addEventListener(
      "animationend",
      () => {
        toast.remove();
      },
      { once: true }
    );
  }, 3500);
};

const switchMode = (nextMode) => {
  state.mode = nextMode;
  state.remainingTime = settings[nextMode];
  state.isRunning = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  updateClock();
  updateProgress();
  updateControls();
  setActiveModeButton();
};

const completeCycle = () => {
  showToast(
    state.mode === "focus" ? "Deep focus complete. Take a breather." : "Break complete. Ready to dive in?"
  );

  if (state.mode === "focus") {
    if (state.currentCycle >= settings.cycles) {
      state.currentCycle = 1;
      switchMode("break");
      updateCycleDots();
      return;
    }
    state.currentCycle += 1;
    updateCycleDots();
    switchMode("break");
  } else {
    switchMode("focus");
  }
};

const tick = () => {
  if (state.remainingTime <= 0) {
    completeCycle();
    return;
  }
  state.remainingTime -= 1;
  updateClock();
  updateProgress();
};

const startTimer = () => {
  if (state.isRunning) return;
  state.isRunning = true;
  updateControls();
  state.intervalId = setInterval(tick, 1000);
};

const pauseTimer = () => {
  if (!state.isRunning) return;
  state.isRunning = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  updateControls();
};

const resetTimer = () => {
  state.remainingTime = settings[state.mode];
  state.isRunning = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  updateClock();
  updateProgress();
  updateControls();
};

const handleModeButtonClick = (event) => {
  const { mode } = event.currentTarget.dataset;
  if (mode === state.mode) return;
  state.currentCycle = 1;
  updateCycleDots();
  switchMode(mode);
};

const handleModeKeydown = (event) => {
  const { key } = event;
  if (!["ArrowLeft", "ArrowRight"].includes(key)) return;

  const modes = Array.from(modeButtons).map((button) => button.dataset.mode);
  const currentIndex = modes.indexOf(state.mode);
  let nextIndex = currentIndex;

  if (key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + modes.length) % modes.length;
  }

  if (key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % modes.length;
  }

  const nextMode = modes[nextIndex];
  if (nextMode !== state.mode) {
    state.currentCycle = 1;
    updateCycleDots();
    switchMode(nextMode);
    modeButtons[nextIndex].focus();
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const pluralize = (value, singular, plural) => `${value} ${value === 1 ? singular : plural}`;

const updateSliderValue = (input) => {
  const span = document.querySelector(`.slider-value[data-for="${input.id}"]`);
  const value = Number(input.value);
  if (input.id === "cycle-count") {
    span.textContent = pluralize(value, "round", "rounds");
  } else {
    span.textContent = `${value} min`;
  }
};

const handleSliderChange = (event) => {
  const input = event.target;
  const value = Number(input.value);

  if (input.id === "focus-length") {
    settings.focus = clamp(value, 1, 90) * 60;
    if (state.mode === "focus") {
      resetTimer();
    }
  }

  if (input.id === "break-length") {
    settings.break = clamp(value, 1, 45) * 60;
    if (state.mode === "break") {
      resetTimer();
    }
  }

  if (input.id === "cycle-count") {
    settings.cycles = clamp(value, 1, 4);
    state.currentCycle = 1;
    updateCycleDots();
  }

  updateSliderValue(input);
};

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);
modeButtons.forEach((button) => {
  button.addEventListener("click", handleModeButtonClick);
  button.addEventListener("keydown", handleModeKeydown);
});

[focusLengthInput, breakLengthInput, cycleCountInput].forEach((input) => {
  updateSliderValue(input);
  input.addEventListener("input", handleSliderChange);
});

updateClock();
updateProgress();
updateControls();
setActiveModeButton();
updateCycleDots();
