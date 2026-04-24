import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve pre-rendered path-style routes (/county/06037, /contact, /methods)
  // without Express issuing a 301 to the trailing-slash URL.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // Skip requests with an extension (assets, .xml, .txt, etc.)
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
    if (req.path === "/") return next();
    // Strip trailing slash if present to find the directory.
    const cleanPath = req.path.replace(/\/$/, "");
    const candidate = path.resolve(distPath, "." + cleanPath + "/index.html");
    // Guard against path traversal
    if (!candidate.startsWith(distPath)) return next();
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
    return next();
  });

  app.use(express.static(distPath, { redirect: false }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
