import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Google Analytics 4 — only loads if VITE_GA4_ID is set at build time and
// looks like a valid measurement ID (G-XXXXXXXX format).
// Uses Google's canonical gtag snippet — `gtag` must be on window so the
// real gtag.js can detect and replace it, and we must push `arguments`
// (not a spread-array) because gtag.js inspects arguments.length.
const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
if (GA4_ID && /^G-[A-Z0-9]{6,}$/.test(GA4_ID)) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", GA4_ID, { anonymize_ip: true });
  // Hash-route SPA — fire page_view on hash changes
  window.addEventListener("hashchange", () => {
    w.gtag("event", "page_view", {
      page_path: window.location.hash.replace("#", "") || "/",
      page_title: document.title,
      page_location: window.location.href,
    });
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

createRoot(document.getElementById("root")!).render(<App />);
