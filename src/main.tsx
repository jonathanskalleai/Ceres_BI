import { createRoot } from "react-dom/client";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import App from "./App.tsx";
import "./index.css";
import { reportClientError } from "./lib/logger";

window.addEventListener("error", (event) => {
  reportClientError("window.error", event.error ?? event.message, { filename: event.filename, line: event.lineno, column: event.colno });
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError("window.unhandledrejection", event.reason);
});

// Vite reports failed module preloads outside React's error boundary. Treat
// the stale-hashed-asset case exactly like the boundary does: one reload gets
// the page's current deploy, while a guard avoids retry loops on a real outage.
window.addEventListener("vite:preloadError", (event) => {
  const url = window.location.href;
  const key = "ceresbi:chunk-reload-url";
  const previous = window.sessionStorage.getItem(key);
  const markerPrefix = `${url}|`;
  const previousAt = previous?.startsWith(markerPrefix)
    ? Number(previous.slice(markerPrefix.length))
    : Number.NaN;
  // Avoid a reload loop during a genuine outage, but allow a later deploy in
  // the same tab to recover again after this short guard window.
  if (Number.isFinite(previousAt) && Date.now() - previousAt < 30_000) return;
  event.preventDefault();
  window.sessionStorage.setItem(key, `${url}|${Date.now()}`);
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
