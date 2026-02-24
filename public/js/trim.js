/**
 * trim.js - Trim start/end time controls
 */

let maxDuration = 0;

export function secondsToTimecode(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function timecodeToSeconds(timecode) {
  if (!timecode || typeof timecode !== 'string') return null;

  const trimmed = timecode.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map(Number);

  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

function validateInput(inputEl) {
  const value = inputEl.value.trim();
  if (!value) {
    inputEl.classList.remove('input-error');
    return;
  }

  const seconds = timecodeToSeconds(value);
  if (seconds === null || seconds < 0) {
    inputEl.classList.add('input-error');
  } else {
    inputEl.classList.remove('input-error');
  }
}

function formatOnBlur(inputEl) {
  const value = inputEl.value.trim();
  if (!value) return;

  const seconds = timecodeToSeconds(value);
  if (seconds !== null && seconds >= 0) {
    inputEl.value = secondsToTimecode(seconds);
  }
}

export function initTrim() {
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');

  if (!startInput || !endInput) return;

  startInput.addEventListener('input', () => validateInput(startInput));
  endInput.addEventListener('input', () => validateInput(endInput));

  startInput.addEventListener('blur', () => formatOnBlur(startInput));
  endInput.addEventListener('blur', () => formatOnBlur(endInput));
}

export function setDuration(seconds) {
  maxDuration = seconds;

  const endInput = document.getElementById('trim-end');
  if (endInput) {
    endInput.placeholder = secondsToTimecode(seconds);
  }
}

export function getTrimSettings() {
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');

  if (!startInput || !endInput) return null;

  const startVal = startInput.value.trim();
  const endVal = endInput.value.trim();

  // If both are empty, no trim
  if (!startVal && !endVal) return null;

  const startSec = startVal ? timecodeToSeconds(startVal) : 0;
  const endSec = endVal ? timecodeToSeconds(endVal) : maxDuration;

  if (startSec === null || endSec === null) return null;
  if (startSec < 0 || endSec < 0) return null;

  // Validate: start < end
  if (startSec >= endSec) {
    if (startInput.value.trim()) startInput.classList.add('input-error');
    if (endInput.value.trim()) endInput.classList.add('input-error');
    return null;
  }

  // Validate: end <= duration (if we know it)
  if (maxDuration > 0 && endSec > maxDuration) {
    endInput.classList.add('input-error');
    return null;
  }

  return {
    start: startSec,
    end: endSec,
  };
}

export function resetTrim() {
  maxDuration = 0;
  const startInput = document.getElementById('trim-start');
  const endInput = document.getElementById('trim-end');

  if (startInput) {
    startInput.value = '';
    startInput.placeholder = '00:00:00';
    startInput.classList.remove('input-error');
  }
  if (endInput) {
    endInput.value = '';
    endInput.placeholder = '00:00:00';
    endInput.classList.remove('input-error');
  }
}
