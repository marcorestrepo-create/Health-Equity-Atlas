import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Google Analytics 4 — gtag.js is loaded inline in index.html (head) with the
// canonical Google snippet for the production measurement ID. This app now uses
// clean browser-location routing (Wouter default hook), so we fire a manual
// page_view on history navigations (pushState/replaceState/popstate). If gtag
// isn't loaded (e.g., adblock, no GA), this is a no-op.
/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;

function trackPageView() {
  if (typeof w.gtag !== "function") return;
  w.gtag("event", "page_view", {
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
    page_location: window.location.href,
  });
}

// Wrap history methods so SPA navigations fire a page_view.
["pushState", "replaceState"].forEach((method) => {
  const original = (history as any)[method];
  (history as any)[method] = function (...args: any[]) {
    const result = original.apply(this, args);
    // Defer so the DOM/title has a chance to update.
    setTimeout(trackPageView, 0);
    return result;
  };
});
window.addEventListener("popstate", () => setTimeout(trackPageView, 0));
/* eslint-enable @typescript-eslint/no-explicit-any */

createRoot(document.getElementById("root")!).render(<App />);
