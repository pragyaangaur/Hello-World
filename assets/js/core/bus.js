/* A very small event bus. Modules raise named signals and never know who
   listens. That is how the tools stay unaware of the story. */

const listeners = new Map();

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn) {
  listeners.get(name)?.delete(fn);
}

export function emit(name, payload) {
  const set = listeners.get(name);
  if (set) for (const fn of Array.from(set)) {
    try { fn(payload, name); } catch (err) { console.error('[bus]', name, err); }
  }
  const any = listeners.get('*');
  if (any) for (const fn of Array.from(any)) {
    try { fn(payload, name); } catch (err) { console.error('[bus:*]', name, err); }
  }
}
