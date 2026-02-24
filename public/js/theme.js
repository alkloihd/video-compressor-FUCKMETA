/**
 * theme.js - Theme management module for Video Compressor
 *
 * Provides a 3-way toggle: Light / System / Dark
 * Persists user choice in localStorage and listens for OS preference changes.
 */

const STORAGE_KEY = 'theme';
const VALID_CHOICES = ['light', 'system', 'dark'];

/**
 * Resolve which effective theme ('light' or 'dark') to apply.
 */
function resolveEffective(choice) {
  if (choice === 'light') return 'light';
  if (choice === 'dark') return 'dark';
  // 'system' - detect from OS
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply the resolved theme to the document.
 */
function applyTheme(effective) {
  const root = document.documentElement;
  root.setAttribute('data-theme', effective);

  // Keep the Tailwind 'dark' class in sync for any Tailwind dark: utilities
  if (effective === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Highlight the active toggle button.
 */
function updateToggleUI(choice) {
  const buttons = document.querySelectorAll('[data-theme-choice]');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.themeChoice === choice;
    btn.setAttribute('aria-pressed', String(isActive));
    if (isActive) {
      btn.classList.add('theme-toggle-active');
    } else {
      btn.classList.remove('theme-toggle-active');
    }
  });
}

/**
 * Get saved preference or default to 'system'.
 */
function getSavedChoice() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_CHOICES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

/**
 * Save preference to localStorage.
 */
function saveChoice(choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Initialize the theme system.
 * Call this as early as possible (ideally from an inline <script> in <head>
 * for the immediate apply, then again from a module for wiring up the toggle).
 */
export function initTheme() {
  const choice = getSavedChoice();
  const effective = resolveEffective(choice);
  applyTheme(effective);

  // Wire up toggle buttons (they may not exist yet during head-inline call)
  const buttons = document.querySelectorAll('[data-theme-choice]');
  if (buttons.length > 0) {
    updateToggleUI(choice);

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const newChoice = btn.dataset.themeChoice;
        if (!VALID_CHOICES.includes(newChoice)) return;

        saveChoice(newChoice);
        const newEffective = resolveEffective(newChoice);
        applyTheme(newEffective);
        updateToggleUI(newChoice);
      });
    });
  }

  // Listen for OS-level preference changes (affects 'system' mode)
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    const currentChoice = getSavedChoice();
    if (currentChoice === 'system') {
      applyTheme(resolveEffective('system'));
    }
  });
}
