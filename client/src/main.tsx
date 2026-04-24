import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Google Analytics 4 — only loads if VITE_GA4_ID is set at build time and
// looks like a valid measurement ID (G-XXXXXXXX format).
const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
if (GA4_ID && /^G-[A-Z0-9]{6,}$/.test(GA4_ID)) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).dataLayer = (window as any).dataLayer || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function gtag(...args: unknown[]) { (window as any).dataLayer.push(args); }
  gtag("js", new Date());
  gtag("config", GA4_ID, { anonymize_ip: true });
  // Hash-route SPA — fire page_view on hash changes
  window.addEventListener("hashchange", () => {
    gtag("event", "page_view", {
      page_path: window.location.hash.replace("#", "") || "/",
      page_title: document.title,
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
