import { useState } from "react";

const STORAGE_KEY_THEME = "theme";
const STORAGE_KEY_ACCENT = "accent";

const THEMES = ["light", "dark"];
const ACCENTS = ["blue", "green", "purple", "rose", "orange"];

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyAccent(accent) {
  const root = document.documentElement;
  if (accent && accent !== "blue") {
    root.setAttribute("data-accent", accent);
  } else {
    root.removeAttribute("data-accent");
  }
}

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY_THEME);
  if (stored && THEMES.includes(stored)) return stored;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function getInitialAccent() {
  const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
  return stored && ACCENTS.includes(stored) ? stored : "blue";
}

// Apply on module load (before first render to avoid flash)
const _initTheme = getInitialTheme();
const _initAccent = getInitialAccent();
applyTheme(_initTheme);
applyAccent(_initAccent);

export function useTheme() {
  const [theme, _setTheme] = useState(_initTheme);
  const [accent, _setAccent] = useState(_initAccent);

  function setTheme(t) {
    _setTheme(t);
    localStorage.setItem(STORAGE_KEY_THEME, t);
    applyTheme(t);
  }

  function setAccent(a) {
    _setAccent(a);
    localStorage.setItem(STORAGE_KEY_ACCENT, a);
    applyAccent(a);
  }

  return { theme, accent, setTheme, setAccent, themes: THEMES, accents: ACCENTS };
}
