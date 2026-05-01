import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Google Analytics 4 — gtag.js is loaded inline in index.html (head) with the
// canonical Google snippet for the production measurement ID. Here we only
// add SPA route tracking: this app uses hash routing (Wouter useHashLocation),
// so the URL changes on navigation don't fire a real navigation event. We
// listen for hashchange and fire a manual page_view so each in-app page is
// counted in GA4. If gtag isn't loaded (e.g., adblock, no GA), this is a no-op.
/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;
window.addEventListener("hashchange", () => {
  if (typeof w.gtag !== "function") return;
  w.gtag("event", "page_view", {
    page_path: window.location.hash.replace("#", "") || "/",
    page_title: document.title,
    page_location: window.location.href,
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */

createRoot(document.getElementById("root")!).render(<App />);
