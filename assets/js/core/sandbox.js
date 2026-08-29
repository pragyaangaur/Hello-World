/* Runs player-written JavaScript inside a Web Worker built from a Blob.
   A worker can be terminated, so a loop that never ends costs a timeout
   instead of the whole tab. Everything is local, so this works offline. */

export function runCode({ prelude = '', code = '', harness = '', timeout = 2500 }) {
  return new Promise(resolve => {
    let url, worker, timer;

    const finish = result => {
      clearTimeout(timer);
      try { worker && worker.terminate(); } catch {}
      if (url) URL.revokeObjectURL(url);
      resolve(result);
    };

    const source = [
      '"use strict";',
      'function __eq(a,b){',
      '  if (a===b) return true;',
      '  if (typeof a!=="object"||typeof b!=="object"||a===null||b===null) return false;',
      '  const ka=Object.keys(a), kb=Object.keys(b);',
      '  if (ka.length!==kb.length) return false;',
      '  return ka.every(k=>__eq(a[k],b[k]));',
      '}',
      'function __show(v){ try { return JSON.stringify(v); } catch { return String(v); } }',
      prelude,
      /* The player's code has to sit at the top level of the worker. A
         function declaration inside a block is block-scoped under strict
         mode, so wrapping this in try/catch would hide it from the tests.
         Errors thrown here surface through the worker's error event. */
      code,
      'try {',
      harness,
      '} catch (e) { self.postMessage({ ok:false, error: (e && e.message) ? e.message : String(e) }); }'
    ].join('\n');

    try {
      const blob = new Blob([source], { type: 'text/javascript' });
      url = URL.createObjectURL(blob);
      worker = new Worker(url);
    } catch (err) {
      finish({ ok: false, error: 'This browser would not start the code runner.' });
      return;
    }

    worker.onmessage = e => finish(e.data);
    worker.onerror = e => {
      e.preventDefault && e.preventDefault();
      const where = e.lineno ? ' (line ' + e.lineno + ')' : '';
      finish({ ok: false, error: (e.message || 'Your code threw before it could run.') + where });
    };
    timer = setTimeout(() => finish({
      ok: false,
      error: 'Your code ran for too long and was stopped. Check for a loop that never ends.'
    }), timeout);
  });
}
