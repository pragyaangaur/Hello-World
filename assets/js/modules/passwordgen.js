import { h, mount, field } from '../core/dom.js';
import { toast } from '../core/notify.js';
import { emit } from '../core/bus.js';

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?'
};
const WORDS = ('able acid aged also area army away baby back ball band bank base bath bear beat been bell belt bend best bike bill bind bird bite blue boat body bold bolt bone book boot bore both bowl bulk burn bush busy cage cake calm camp cane card care case cash cast cell chip city clay clip club coal coat code coil cold cook cool cope copy cord core cork corn cost cove crew crop cube cure curl dark data dawn deal dean dear debt deck deep deer dent desk dial dice diet disc dish dock does dome done door dose down drag draw drum dual dust duty each earn ease east easy edge exit face fact fade fail fair fall farm fast fear feed feel file fill film find fine fire firm fish fist flag flat flex flip flow foam fold fond food fork form fort four fuel full fund gain game gate gave gear gene gift girl give glad glow goal goes gold golf gone good gram grew grid grip grow gulf hair half hall hand hang hard harm haul have hawk head heal heap heat held helm help herb here hide high hill hint hire hold hole home hood hook hope horn host hour huge hunt idea idle inch into iron item jazz join jump junk keen keep kept kick kind king kite knee knew knot lab lace lack lake lamp land lane last late lava lawn lead leaf lean leap left lend lens less lift like limb lime line link lion list live load loan lock loft logo long look loop lord lose loss loud love luck lump lung made mail main make male mall many mark mask mass mast mate math meal mean meat melt mesh mile milk mill mind mine mint miss mist mode mold mole monk mood moon more moss most move much mule name near neat neck need nest news next nice node none noon norm nose note noun oak oath odds oily omit once only open oral oven over pace pack page paid pain pair pale palm park part pass past path peak pear peer pick pier pile pine pink pipe pity plan play plot plug plus poem poet pole pond pool poor pope pork port pose post pour pull pump pure push quit quiz race rack raid rail rain ramp rank rare rate read real reef reel rely rent rest rice rich ride ring rise risk road roar rock role roll roof room root rope rose rule rush rust safe sage sail salt same sand save scan seal seat seed seek self sell send sent shed ship shoe shop shot show shut side sign silk sing sink site size skin slab slam slip slot slow snap snow soak soap soft soil sold sole solo sort soul soup sour span spin spot spun star stay stem step stir stop such suit sunk sure surf swam swap swim tail take tale talk tall tank tape task team tear tech tell tend tent term test text than that them then they thin this thus tide tidy tile time tiny tire toad toll tone tool torn tour town trap tray tree trim trip true tube tune turn twin type unit upon urge used user vast verb very vest view vine visa void volt vote wage wait wake walk wall wand want ward warm warn wash wave weak wear weed week well went were west what when whip whom wide wife wild will wind wine wing wipe wire wise wish wolf wood wool word wore work worm worn wrap yard yarn yawn year yoga your zero zinc zone zoom').split(' ');

function randInt(max) {
  const a = new Uint32Array(1);
  const limit = Math.floor(4294967296 / max) * max;
  let v;
  do { crypto.getRandomValues(a); v = a[0]; } while (v >= limit);
  return v % max;
}
const pick = arr => arr[randInt(arr.length)];

export function makePassword(len, opts) {
  let pool = '';
  if (opts.lower) pool += SETS.lower;
  if (opts.upper) pool += SETS.upper;
  if (opts.digits) pool += SETS.digits;
  if (opts.symbols) pool += SETS.symbols;
  if (!pool) return '';
  let out = '';
  for (let i = 0; i < len; i++) out += pool[randInt(pool.length)];
  return out;
}

export function makePassphrase(words, sep) {
  return Array.from({ length: words }, () => pick(WORDS)).join(sep) + randInt(90) + 10;
}

export function entropyBits(len, opts) {
  let pool = 0;
  if (opts.lower) pool += SETS.lower.length;
  if (opts.upper) pool += SETS.upper.length;
  if (opts.digits) pool += SETS.digits.length;
  if (opts.symbols) pool += SETS.symbols.length;
  return pool ? Math.round(len * Math.log2(pool)) : 0;
}

export default {
  id: 'passwordgen',
  name: 'Password generator',
  dept: 'Everyday',
  icon: '⚿',
  chapter: 1,
  blurb: 'Random, from the browser',

  mount(root) {
    let mode = 'chars';
    let len = 18;
    const opts = { lower: true, upper: true, digits: true, symbols: true };

    const out = h('div.readout', { style: { wordBreak: 'break-all', whiteSpace: 'normal' } }, '');
    const strength = h('div.small.dim');
    const lenLabel = h('span.mono', String(len));
    const slider = h('input', { type: 'range', min: '6', max: '48', value: String(len), 'aria-label': 'Length' });

    function regen() {
      const value = mode === 'chars' ? makePassword(len, opts) : makePassphrase(Math.max(3, Math.round(len / 5)), '-');
      out.textContent = value || 'Pick at least one character set.';
      const bits = mode === 'chars' ? entropyBits(len, opts) : Math.round(Math.max(3, Math.round(len / 5)) * Math.log2(WORDS.length) + 6.5);
      const label = bits < 45 ? 'weak' : bits < 65 ? 'reasonable' : bits < 90 ? 'strong' : 'very strong';
      strength.textContent = `About ${bits} bits of entropy, which is ${label}.`;
      strength.style.color = bits < 45 ? 'var(--danger)' : bits < 65 ? 'var(--warn)' : 'var(--ok)';
      if (value) emit('tool:value', { tool: 'passwordgen', value });
    }

    slider.oninput = e => { len = +e.target.value; lenLabel.textContent = String(len); regen(); };

    const boxes = h('div.row');
    for (const [key, label] of [['lower', 'a-z'], ['upper', 'A-Z'], ['digits', '0-9'], ['symbols', '!@#']]) {
      boxes.appendChild(h('label.row.tight', { style: { gap: '.35rem', cursor: 'pointer' } },
        h('input', { type: 'checkbox', checked: opts[key], onchange: e => { opts[key] = e.target.checked; regen(); } }),
        h('span.small', label)
      ));
    }

    mount(root,
      h('div.tabs', { role: 'tablist' },
        ...[['chars', 'Characters'], ['words', 'Passphrase']].map(([k, l]) =>
          h('button.tab', { type: 'button', role: 'tab', 'aria-selected': String(mode === k),
            onclick: e => { mode = k; root.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === e.target))); regen(); } }, l))
      ),
      h('div.card',
        out,
        h('div.row', { style: { marginTop: '.75rem' } },
          h('button.btn.btn-primary', { type: 'button', onclick: regen }, 'Generate'),
          h('button.btn', { type: 'button', onclick: async () => {
            try { await navigator.clipboard.writeText(out.textContent); toast('Copied', 'The password is on your clipboard.'); }
            catch { toast('Could not copy', 'Your browser blocked clipboard access. Select the text instead.'); }
          } }, 'Copy'),
          h('span.spacer'), strength
        )
      ),
      h('div.card',
        h('div.row', h('span.lbl', 'Length'), lenLabel, h('span.spacer'), boxes),
        slider,
        h('p.small.dim', { style: { marginTop: '.5rem', marginBottom: 0 } },
          'Generated with crypto.getRandomValues in your browser. Nothing is sent anywhere, and nothing is stored.')
      )
    );
    regen();
  }
};
