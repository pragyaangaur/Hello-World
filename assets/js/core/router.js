/* Hash routing, so deep links survive a static host with no rewrites. */

import { emit } from './bus.js';

const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) { routes.push({ pattern, handler }); }
export function fallback(handler) { notFound = handler; }

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { path: '/' + parts.join('/'), parts, query };
}

function match(pattern, parts) {
  const pp = pattern.split('/').filter(Boolean);
  if (pp.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (pp[i] !== parts[i]) return null;
  }
  return params;
}

export function resolve() {
  const loc = parse();
  for (const r of routes) {
    const params = match(r.pattern, loc.parts);
    if (params) {
      current = { ...loc, params, pattern: r.pattern };
      emit('route', current);
      r.handler(current);
      return current;
    }
  }
  current = { ...loc, params: {}, pattern: null };
  emit('route', current);
  if (notFound) notFound(current);
  return current;
}

export function go(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === target) { resolve(); return; }
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) resolve();
}

export function here() { return current; }

export function start(defaultPath = '/tasks') {
  addEventListener('hashchange', () => resolve());
  if (!location.hash || location.hash === '#') go(defaultPath, { replace: true });
  else resolve();
}
