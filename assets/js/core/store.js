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

/* Merges a saved object over the defaults, one level down as well as at the
   top. A flat spread looked right until a new setting was added: the saved
   settings object replaced the default one whole, so everybody who had used
   the app before that release got the new key as undefined and whatever
   undefined happens to mean wherever it is read. Arrays and nulls are taken
   from the saved copy as they are, because those are values rather than
   groups of keys. */
function fill(defaults, saved) {
  const out = { ...defaults };
  for (const [key, value] of Object.entries(saved)) {
    const base = defaults[key];
    /* A group of settings saved as null is a broken file rather than a
       choice, so the defaults stand. */
    if (value === null && base && typeof base === 'object') continue;
    const nested = base && value
      && typeof base === 'object' && typeof value === 'object'
      && !Array.isArray(base) && !Array.isArray(value);
    out[key] = nested ? fill(base, value) : value;
  }
  return out;
}

export function load(fallback = {}) {
  const raw = readRaw(KEY_MAIN);
  if (!raw) return structuredClone(fallback);
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return structuredClone(fallback);
    return fill(structuredClone(fallback), saved);
  } catch { return structuredClone(fallback); }
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
