import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "light"; // default: light mode
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Simple pub-sub so multiple hook consumers stay in sync
let currentTheme: Theme = typeof window !== "undefined" ? getStoredTheme() : "light";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  listeners.forEach((cb) => cb());
}

// Apply on module load so there's no flash
if (typeof window !== "undefined") {
  applyTheme(currentTheme);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

  useEffect(() => {
    // Ensure DOM is synced if another tab changed localStorage
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  }, []);

  const isDark = theme === "dark";

  return { theme, isDark, toggle } as const;
}
