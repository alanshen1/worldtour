// perf.js: the ?debug readout. It answers two questions with numbers instead of guesses:
//   "why does it stutter?"  frame times, and how much of each frame goes to which part of the engine
//   "why is it blurred?"    tiles waiting, tiles refused by a full cache, and how full the cache is
// Add ?debug to the address, BEFORE the # (for example /?debug#taipei). Once a second the box in the top-left corner
// shows the last second; click it to copy the last 60 seconds as JSON. window.__perf holds the same data.
// Without ?debug every function here returns at once and nothing is measured or wrapped.
export const PERF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

const LONG_MS = 25;   // a frame longer than this always counts as a stutter (60 fps is 16.7 ms, 30 fps is 33 ms)
let acc = {}, frames = [], lastFlush = 0, box = null, source = () => ({});
// On a fast screen a stutter is shorter than that: at 144 Hz a frame is 6.9 ms, and one of 14 ms is two frames lost.
// So the limit follows the screen: 1.8 times the middle (median) frame of the second before, plus 1 ms, and never above
// LONG_MS. (Not the shortest frame: straight after a long frame the browser fires one or two very short ones.)
let baseMs = 16.7;
const longLimit = () => Math.min(LONG_MS, Math.round((baseMs * 1.8 + 1) * 10) / 10);
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
/** Pure: the middle value of a list of numbers (16.7 for an empty one). Exported for the test. */
export const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[list.length >> 1] : 16.7);

/**
 * Pure: turns one second of measurements into the record that is shown and kept. Exported for the test.
 * Parts whose name starts with "raf:" or "in:" are a second view of time already counted elsewhere (a whole frame
 * callback, or a piece inside one), so they are listed but left out of the sum behind "other".
 */
export function summarize(frameMs, parts, seconds, extra = {}, limit = LONG_MS) {
  const n = frameMs.length, total = frameMs.reduce((s, x) => s + x, 0);
  const out = {
    fps: n ? Math.round(n / seconds) : 0,
    avgMs: n ? r1(total / n) : 0,
    worstMs: n ? r1(Math.max(...frameMs)) : 0,
    longFrames: frameMs.filter((x) => x > limit).length, frames: n, longLimitMs: limit,
    parts: {},
    ...extra,
  };
  let counted = 0;
  for (const [name, a] of Object.entries(parts)) {
    out.parts[name] = { perFrameMs: n ? r1(a.ms / n) : 0, maxMs: r1(a.max), calls: a.n };
    if (!name.startsWith('raf:') && !name.startsWith('in:')) counted += a.ms;   // a frame runs from one frame to the next, so work between frames counts too
  }
  // what a frame costs beyond the engine's own measured work: the libraries' work (parsing tiles, composing ground
  // photos), the graphics card finishing the picture, the browser (uploading textures, decoding, collecting garbage)
  out.unaccountedPerFrameMs = n ? r1(Math.max(0, (total - counted) / n)) : 0;
  return out;
}

/**
 * Pure: from the browser's long-animation-frame entries (frames over 50 ms), which scripts the time went to.
 * Each script is named by what started it and where its code is: "resolve-promise parseTile renderer.js@12345 38ms".
 * Exported for the test.
 */
export function slowScripts(entries, top = 5) {
  const by = new Map(); let count = 0, blockedMs = 0;
  for (const e of entries ?? []) {
    count++; blockedMs += e.blockingDuration ?? 0;
    for (const sc of e.scripts ?? []) {
      const file = String(sc.sourceURL ?? '').split('/').pop().split('?')[0];
      const what = `${sc.invokerType ?? '?'} ${sc.sourceFunctionName || sc.invoker || '(anonymous)'}${file ? ` ${file}@${sc.sourceCharPosition ?? '?'}` : ''}`;
      by.set(what, (by.get(what) ?? 0) + (sc.duration ?? 0));
    }
  }
  return { frames: count, blockedMs: Math.round(blockedMs), scripts: [...by].sort((a, b) => b[1] - a[1]).slice(0, top).map(([what, ms]) => ({ what, ms: Math.round(ms) })) };
}

/** Pure: the text of the box for one record. Exported for the test. */
export function format(s) {
  const p = (name, label = name) => { const a = s.parts[name]; return a ? `${label} ${a.perFrameMs}/f max ${a.maxMs}` : `${label} -`; };
  const b = (name, label) => { const a = s.parts[name]; return a ? `${label} ${a.calls}x max ${a.maxMs} ms` : `${label} -`; };
  const m = (name, label) => { const a = s.parts[name]; return a ? `${label} max ${a.maxMs}` : `${label} -`; };
  const t = s.tiles ?? {}, c = s.cache ?? {};
  const slow = s.slow === undefined ? '(this browser does not report them)'
    : !s.slow.frames ? '-' : `${s.slow.frames} frame(s): ` + (s.slow.scripts.map((x) => `${x.what} ${x.ms}ms`).join(' | ') || 'no script named');
  return [
    `${s.city ?? '?'} · ${s.mode ?? '?'} · t ${s.t ?? '?'} · pace ${s.pace ?? '?'}${s.hurry ? ' · fast-forward' : ''}${s.next ? ' · next ' + s.next : ''}`,
    `fps ${s.fps}   avg ${s.avgMs} ms   worst ${s.worstMs} ms   stutters(>${s.longLimitMs ?? LONG_MS}ms) ${s.longFrames}/${s.frames}`,
    `${p('tiles', 'tiles.update')}   ${p('roof')}   ${p('draw')}   ${p('warm')}   other ${s.unaccountedPerFrameMs}/f`,
    `frame callbacks (ms): ${m('raf:loop', 'engine')}   ${m('raf:other', 'libraries')}   ${b('in:parseStart', 'tile parse starts')}`,
    `${b('osmTile', 'osm tile build')}   ${b('tint', 'photo tile build')}   ${b('nextRefine', 'next-city refine')}`,
    `calls ${s.calls ?? '?'}   tris ${s.tris ?? '?'}   geometries ${s.geometries ?? '?'}   textures ${s.textures ?? '?'}   programs ${s.programs ?? '?'}`,
    `tiles visible ${t.visible ?? '?'} active ${t.active ?? '?'} | queued ${t.queued ?? 0} downloading ${t.downloading ?? 0} parsing ${t.parsing ?? 0} | REFUSED ${t.refused ?? 0} failed ${t.failed ?? 0}`,
    `cache ${c.mb ?? '?'}/${c.maxMb ?? '?'} MB   items ${c.items ?? '?'}/${c.maxItems ?? '?'}   ratio ${s.ratio ?? '?'}   ${s.size ?? ''}   errorTarget ${s.errorTarget ?? '?'}`,
    `frames over 50 ms: ${slow}`,
  ].join('\n');
}

function ensureBox() {
  if (box) return box;
  box = document.createElement('pre');
  box.id = 'perf';
  box.title = 'click to copy the last 60 seconds as JSON';
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;margin:0;padding:8px 10px;font:11px/1.45 ui-monospace,Menlo,monospace;'
    + 'color:#d8f0ff;background:rgba(4,8,14,.78);border-radius:6px;white-space:pre;cursor:copy;pointer-events:auto;user-select:none;max-width:96vw;overflow:hidden';
  box.onclick = async () => {
    const text = JSON.stringify(history.slice(-60));
    try { await navigator.clipboard.writeText(text); box.style.outline = '1px solid #7fd4ff'; setTimeout(() => { box.style.outline = ''; }, 600); }
    catch (e) { console.log(text); }
  };
  document.body.appendChild(box);
  return box;
}

// The browser's own account of frames over 50 ms and the scripts that ran in them (Chrome's Long Animation Frames).
// It names work that no timer here covers: a tile parsed inside a library, a promise that resumed with a heavy step.
let slowEntries = null;
function watchSlowFrames() {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) return;
    slowEntries = [];
    new PerformanceObserver((list) => { slowEntries.push(...list.getEntries()); }).observe({ type: 'long-animation-frame', buffered: false });
  } catch (e) { slowEntries = null; }
}

/** Call once per drawn frame with the frame's length in ms and the time now. Updates the box once a second. */
export function perfFrame(ms, now) {
  if (!PERF) return;
  if (!lastFlush) { lastFlush = now; acc = {}; return; }
  frames.push(ms);
  if (now - lastFlush < 1000) return;
  let extra = {};
  try { extra = source() ?? {}; } catch (e) { extra = { sourceError: String(e) }; }
  const s = summarize(frames, acc, (now - lastFlush) / 1000, extra, longLimit());
  if (slowEntries) { s.slow = slowScripts(slowEntries); slowEntries = []; }
  baseMs = median(frames);
  history.push(s); if (history.length > 300) history.shift();
  ensureBox().textContent = format(s);
  frames = []; acc = {}; lastFlush = now;
}

if (PERF && typeof window !== 'undefined') {
  window.__perf = { history, get last() { return history[history.length - 1]; } };
  watchSlowFrames();
  // Time every animation-frame callback: the engine's own (function loop) and everybody else's (the tile library runs
  // its job queues in such callbacks; the warm-up of the next city too). A long "libraries" callback is a stutter the
  // engine did not cause itself.
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const t0 = performance.now();
    try { return cb(t); } finally { perfAdd(cb.name === 'loop' ? 'raf:loop' : 'raf:other', performance.now() - t0); }
  });
}
