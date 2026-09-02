// Tiny local server: every /api/data request rescans from disk (no cache),
// so a browser refresh is always current. Zero dependencies (ADR-0001).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath, scanAll, prDeltas } from './scan.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolveConfigPath();
const INDEX = path.join(ROOT, 'public', 'index.html');
// Spec 009-01: the overview/detail render helpers are a real ES module
// (public/render.mjs), imported both by the browser (<script type="module">)
// and directly by node:test — the "shared, not duplicated" testability
// decision (plan.md) needs the browser to actually be able to fetch it.
// One explicit route, not a generic static-file server (no path-traversal
// surface to reason about, ADR-0001 stays zero-dep).
const RENDER_MJS = path.join(ROOT, 'public', 'render.mjs');

// ADR-0007 / spec 010-01: phase one (`/api/data`) is disk-only and never
// spawns `gh` — the disabled context reuses the proven 009-04 no-gh path
// (scanProject only reads PRs when `gh.available`), so first paint pays only
// the disk-scan cost. Phase two (`/api/prs`) runs the real, gh-enriched scan
// (buildGhContext, scanAll's default) and returns per-project deltas.
const DISABLED_GH = { available: false, ownerLogin: null, listPRs: () => [] };

let config;
try {
  config = loadConfig(CONFIG_PATH);
} catch (err) {
  console.error(`could not read config at ${CONFIG_PATH}: ${err.message}`);
  console.error(
    'create ~/.claude/my-dashboard/config.json (see dashboard.config.example.json ' +
    'in the plugin/repo root) or point DASHBOARD_CONFIG at your config file.'
  );
  process.exit(1);
}
const port = Number(process.env.PORT || config.port || 5111);

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(INDEX));
  } else if (url === '/render.mjs') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    res.end(fs.readFileSync(RENDER_MJS));
  } else if (url === '/api/data') {
    try {
      const data = scanAll(loadConfig(CONFIG_PATH), { gh: DISABLED_GH });
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    }
  } else if (url === '/api/prs') {
    try {
      const data = scanAll(loadConfig(CONFIG_PATH));
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify({ generatedAt: data.generatedAt, projects: prDeltas(data) }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    }
  } else {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`project dashboard → http://localhost:${port}`);
});
