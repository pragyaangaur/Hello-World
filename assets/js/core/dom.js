/* Tiny DOM helpers. Nothing here knows anything about the app. */

const SEL = /([.#][^.#]+)/g;

/**
 * h('div.card#main', { onclick, class, style, html, ...attrs }, ...children)
 * Children may be nodes, strings, numbers, arrays, or null.
 */
export function h(spec, props, ...children) {
  let tag = spec, cls = [], id = null;
  const parts = spec.match(SEL);
  if (parts) {
    tag = spec.slice(0, spec.indexOf(parts[0])) || 'div';
    for (const p of parts) {
      if (p[0] === '.') cls.push(p.slice(1));
      else id = p.slice(1);
    }
  }
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (cls.length) el.className = cls.join(' ');

  if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  } else if (props !== undefined && props !== null) {
    children.unshift(props);
  }

  append(el, children);
  return el;
}

export function append(el, kids) {
  for (const c of kids.flat(4)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function mount(el, ...nodes) { clear(el); return append(el, nodes); }

/** A labelled form field. */
export function field(label, control, hint) {
  return h('div.field', h('label', { for: control.id || undefined }, label), control, hint ? h('span.hint', hint) : null);
}

/** A definition list of readouts. */
export function kv(pairs) {
  const dl = h('dl.kv');
  for (const [k, v] of pairs) { dl.appendChild(h('dt', k)); dl.appendChild(h('dd', v)); }
  return dl;
}

export function btn(label, props = {}) {
  return h('button.btn', { type: 'button', ...props }, label);
}

/** Debounce, used by the live-editing tools. */
export function debounce(fn, ms = 120) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const fmt = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)).toLocaleString('en-GB', { maximumFractionDigits: d }) : '—');
export const pad2 = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
