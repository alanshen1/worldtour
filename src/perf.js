// perf.js: the ?debug readout. It answers two questions with numbers instead of guesses:
//   "why does it stutter?"  frame times, and how much of each frame goes to which part of the engine
//   "why is it blurred?"    tiles waiting, tiles refused by a full cache, and how full the cache is
// Add ?debug to the address (for example /?debug#taipei). Once a second the box in the top-left corner shows the last
// second; click it to copy the last 60 seconds as JSON. window.__perf holds the same data.
// Without ?debug every function here returns at once and nothing is measured.
export const PERF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

const LONG_MS = 25;   // a frame longer than this is counted as a stutter (60 fps is 16.7 ms, 30 fps is 33 ms)
let acc = {}, frames = [], lastFlush = 0, box = null, source = () => ({});
const history = [];

/** Adds `ms` of work to the part called `name` (for this second). */
export function perfAdd(name, ms) {
  if (!PERF) return;
  const a = acc[name] ??= { ms: 0, n: 0, max: 0 };
  a.ms += ms; a.n++; if (ms > a.max) a.max = ms;
}
/** Runs fn and counts the time it took under `name`. */
export function perfTime(name, fn) {
  if (!PERF) return fn();
  const t0 = performance.now();
  try { return fn(); } finally { perfAdd(name, performance.now() - t0); }
}
/** main.js hands over a function that returns the counters only the engine can read (city, draw calls, tiles ...). */
export function perfSource(fn) { source = fn; }

const r1 = (x) => Math.round(x * 10) / 10;
/** Pure: turns one second of measurements into the record that is shown and kept. Exported for the test. */
export function summarize(frameMs, parts, seconds, extra = {}) {
  const n = frameMs.length, total = frameMs.reduce((s, x) => s + x, 0);
  const out = {
    fps: n ? Math.round(n / seconds) : 0,
    avgMs: n ? r1(total / n) : 0,
    worstMs: n ? r1(Math.max(...frameMs)) : 0,
    longFrames: frameMs.filter((x) => x > LONG_MS).length, frames: n,
    parts: {},
    ...extra,
  };
  let counted = 0;
  for (const [name, a] of Object.entries(parts)) {
    out.parts[name] = { perFrameMs: n ? r1(a.ms / n) : 0, maxMs: r1(a.max), calls: a.n };
    counted += a.ms;   // a frame's length is the time from one frame to the next, so work done between frames counts too
  }
  // what a frame costs beyond the engine's own measured work: mostly the graphics card finishing the picture,
  // plus the browser's own work (uploading textures, decoding pictures, collecting garbage)
  out.unaccountedPerFrameMs = n ? r1(Math.max(0, (total - counted) / n)) : 0;
  return out;
}
/** Pure: the text of the box for one record. Exported for the test. */
export function format(s) {
  const p = (name, label = name) => { const a = s.parts[name]; return a ? `${label} ${a.perFrameMs}/f max ${a.maxMs}` : `${label} -`; };
  const b = (name, label) => { const a = s.parts[name]; return a ? `${label} ${a.calls}x max ${a.maxMs} ms` : `${label} -`; };
  const t = s.tiles ?? {}, c = s.cache ?? {};
  return [
    `${s.city ?? '?'} · ${s.mode ?? '?'} · t ${s.t ?? '?'} · pace ${s.pace ?? '?'}${s.hurry ? ' · fast-forward' : ''}${s.next ? ' · next ' + s.next : ''}`,
    `fps ${s.fps}   avg ${s.avgMs} ms   worst ${s.worstMs} ms   stutters(>${LONG_MS}ms) ${s.longFrames}/${s.frames}`,
    `${p('tiles', 'tiles.update')}   ${p('roof')}   ${p('draw')}   ${p('warm')}   other ${s.unaccountedPerFrameMs}/f`,
    `${b('osmTile', 'osm tile build')}   ${b('tint', 'photo tile build')}   ${b('nextRefine', 'next-city refine')}`,
    `calls ${s.calls ?? '?'}   tris ${s.tris ?? '?'}   geometries ${s.geometries ?? '?'}   textures ${s.textures ?? '?'}   programs ${s.programs ?? '?'}`,
    `tiles visible ${t.visible ?? '?'} active ${t.active ?? '?'} | queued ${t.queued ?? 0} downloading ${t.downloading ?? 0} parsing ${t.parsing ?? 0} | REFUSED ${t.refused ?? 0} failed ${t.failed ?? 0}`,
    `cache ${c.mb ?? '?'}/${c.maxMb ?? '?'} MB   items ${c.items ?? '?'}/${c.maxItems ?? '?'}   ratio ${s.ratio ?? '?'}   ${s.size ?? ''}   errorTarget ${s.errorTarget ?? '?'}`,
  ].join('\n');
}

function ensureBox() {
  if (box) return box;
  box = document.createElement('pre');
  box.id = 'perf';
  box.title = 'click to copy the last 60 seconds as JSON';
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;margin:0;padding:8px 10px;font:11px/1.45 ui-monospace,Menlo,monospace;'
    + 'color:#d8f0ff;background:rgba(4,8,14,.78);border-radius:6px;white-space:pre;cursor:copy;pointer-events:auto;user-select:none';
  box.onclick = async () => {
    const text = JSON.stringify(history.slice(-60));
    try { await navigator.clipboard.writeText(text); box.style.outline = '1px solid #7fd4ff'; setTimeout(() => { box.style.outline = ''; }, 600); }
    catch (e) { console.log(text); }
  };
  document.body.appendChild(box);
  return box;
}

/** Call once per drawn frame with the frame's length in ms and the time now. Updates the box once a second. */
export function perfFrame(ms, now) {
  if (!PERF) return;
  if (!lastFlush) { lastFlush = now; acc = {}; return; }
  frames.push(ms);
  if (now - lastFlush < 1000) return;
  let extra = {};
  try { extra = source() ?? {}; } catch (e) { extra = { sourceError: String(e) }; }
  const s = summarize(frames, acc, (now - lastFlush) / 1000, extra);
  history.push(s); if (history.length > 300) history.shift();
  ensureBox().textContent = format(s);
  frames = []; acc = {}; lastFlush = now;
}

if (PERF && typeof window !== 'undefined') window.__perf = { history, get last() { return history[history.length - 1]; } };
