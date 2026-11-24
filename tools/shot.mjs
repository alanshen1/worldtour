// Takes still frames of one city along its flight, for checking a city while building it.
// Usage: node tools/shot.mjs <city-id> [outDir] [--t 0.02,0.2,0.4,0.6,0.8,0.95] [--next <id>|none] [--overview] [--size 1280x720]
// Writes <outDir>/<city-id>-<t>.png (and -overview.png), prints draw calls, triangles, build time and any page errors.
// Real (Google 3D tiles) cities: each frame waits until the tiles in view have loaded (TILES-NOT-LOADED if they never did),
// and `lift` says how far the engine raised the camera above the path to clear real roofs (a sign the path is too low there).
// Needs Playwright with Chromium (present in Claude cloud sessions; elsewhere: npm i -D playwright && npx playwright install chromium).
import { serve } from './serve.mjs'; import fs from 'node:fs'; import path from 'node:path';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const flags = new Set(['--t', '--next', '--size']); const pos = args.filter((a, i) => !a.startsWith('--') && !flags.has(args[i - 1]));
const id = pos[0], out = pos[1] || 'shots'; if (!id) { console.error('usage: node tools/shot.mjs <city-id> [outDir] [--t 0.1,0.5] [--next id|none] [--overview]'); process.exit(1); }
const ts = opt('t', '0.02,0.2,0.4,0.6,0.8,0.95').split(',').map(Number), [W, H] = opt('size', '1280x720').split('x').map(Number);
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // require() also finds a globally installed Playwright
const port = 8100 + Math.floor(Math.random() * 800), server = await serve(port);
// real cities stream Google 3D tiles: go out through the session's HTTPS proxy where there is one (it adds the key)
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch({ proxy, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
let errors = 0; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { if (/GPU stall|swiftshader|Automatic fallback|KHR_parallel_shader_compile/i.test(m.text())) return; errors++; console.log(`[page ${m.type()}] ${m.text()}`); } });
page.on('pageerror', (e) => { errors++; console.log('[page error] ' + e.message); });
const next = opt('next', ''); await page.goto(`http://127.0.0.1:${port}/?shot&city=${id}${next ? '&next=' + next : ''}`);
try {
  await page.waitForFunction(() => window.__tour, null, { timeout: 420000 });
  fs.mkdirSync(out, { recursive: true });
  const snap = async (name, t, ov) => {
    const info = await page.evaluate(([t, ov]) => window.__tour.shot(t, ov), [t, ov]);
    const file = path.join(out, `${id}-${name}.png`); await page.screenshot({ path: file });
    console.log(`${file}  calls=${info.calls} tris=${info.triangles} build=${info.buildMs}ms path=${info.pathLength}m next=${info.next}` + (info.loaded === false ? ' TILES-NOT-LOADED' : '') + (info.lift ? ` lift=${info.lift}m` : '') + (info.groundM !== undefined ? ` ground=${info.groundM}m` : ''));
  };
  for (const t of ts) await snap(t.toFixed(2), t, false);
  if (args.includes('--overview')) { await snap('overview', 0.5, 0.6); await snap('overview2', 0.5, 3.7); }
} catch (e) { errors++; console.log('[shot failed] ' + e.message); }
await browser.close(); server.close(); process.exit(errors ? 2 : 0);
