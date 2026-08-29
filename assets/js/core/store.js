/* localStorage with a namespace and a safe fallback.
   Two keys exist. One holds everything a reset clears. The other holds the
   handful of facts the app keeps regardless, and it is written rarely. */

const KEY_MAIN = 'helloworld.v1';
const KEY_KEEP = 'helloworld.install';

let memory = {};   /* used when storage is unavailable, e.g. private mode */
let usable = true;

try {
  const probe = '__hw_probe__';
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
} catch { usable = false; }

function readRaw(key) {
  if (!usable) return memory[key] ?? null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeRaw(key, value) {
  if (!usable) { memory[key] = value; return; }
  try { localStorage.setItem(key, value); } catch { /* quota, ignore */ }
}
function dropRaw(key) {
  if (!usable) { delete memory[key]; return; }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function load(fallback = {}) {
  const raw = readRaw(KEY_MAIN);
  if (!raw) return structuredClone(fallback);
  try { return { ...structuredClone(fallback), ...JSON.parse(raw) }; }
  catch { return structuredClone(fallback); }
}

export function save(obj) { writeRaw(KEY_MAIN, JSON.stringify(obj)); }

export function clearMain() { dropRaw(KEY_MAIN); }

/* ---- the key that survives a reset ---- */
export function keep() {
  const raw = readRaw(KEY_KEEP);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
export function setKeep(patch) {
  writeRaw(KEY_KEEP, JSON.stringify({ ...keep(), ...patch }));
}
export function storageWorks() { return usable; }
