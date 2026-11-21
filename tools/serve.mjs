// A small static file server for running the site on your own machine. Needs only Node.
// Usage: node tools/serve.mjs [port]     (npm start serves on port 8000)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
export function serve(port = 8000) {
  const server = http.createServer((req, res) => {
    const say = (code, text) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); };
    let rel; try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { return say(400, 'bad request'); }
    if (rel.includes('\0')) return say(400, 'bad request');
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep)) return say(403, 'forbidden');
    fs.readFile(file, (err, body) => {
      if (err) return say(404, 'not found');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body);
    });
  });
  return new Promise((ok, no) => { server.on('error', no); server.listen(port, '127.0.0.1', () => ok(server)); });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.PORT || 8000);
  serve(port).then(() => console.log(`世界巡游 is running at http://localhost:${port}/   (Ctrl+C stops it)`), (e) => { console.error(String(e)); process.exit(1); });
}
