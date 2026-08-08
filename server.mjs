import http from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
};

export function startServer(port = 8742, dir = root) {
  return http.createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = normalize(join(dir, url === "/" ? "index.html" : url));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  }).listen(port, () => console.log(`鱼定村小馆 · http://localhost:${port}`));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  startServer(Number(process.argv[2] || 8742));
}
