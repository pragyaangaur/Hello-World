import { h, mount, fmt } from '../core/dom.js';
import { chapter } from '../core/state.js';
import { NOW, liveTemp, RIG } from '../story/cast.js';

/* No API key, no network to a third party. The forecast is generated from
   monthly climate normals held in a local file, which is honest and also
   means the app keeps working with the wifi off. */

const ICONS = { clear: '☀', cloud: '☁', rain: '☂', storm: '⚡', mist: '≈' };

function seeded(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

function forecast(place, days = 7) {
  const out = [];
  const base = place.normals;
  for (let i = 0; i < days; i++) {
    const r1 = seeded(place.lat * 100 + i * 7 + NOW.getDate());
    const r2 = seeded(place.lon * 100 + i * 13 + NOW.getDate());
    const high = base.highC + (r1 - 0.5) * 6;
    const low = base.lowC + (r2 - 0.5) * 4;
    const pop = Math.min(95, Math.max(2, Math.round(base.rainMm / 2 + (r1 - 0.5) * 40)));
    const cond = pop > 70 ? (r2 > 0.7 ? 'storm' : 'rain') : pop > 45 ? 'rain' : pop > 25 ? 'cloud' : r2 > 0.85 ? 'mist' : 'clear';
    out.push({
      date: new Date(NOW.getTime() + i * 86400000),
      high, low, pop, cond,
      humidity: Math.round(base.humidity + (r2 - 0.5) * 14),
      wind: Math.round(4 + r1 * 18)
    });
  }
  return out;
}

export default {
  id: 'weather',
  name: 'Weather',
  dept: 'Everyday',
  icon: '☁',
  chapter: 3,
  blurb: 'Seven days, works offline',
  wide: true,

  mount(root) {
    const body = h('div.stack', h('p.small.dim', 'Loading the offline reference…'));
    mount(root, body);
    let data = null, current = 'pune';

    fetch('assets/data/weather.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(json => { data = json; paint(); })
      .catch(() => {
        mount(body, h('div.card',
          h('h3', 'Could not load the reference data'),
          h('p.small', 'assets/data/weather.json did not load. If you opened this file straight from disk, a browser will block it. Serve the folder over HTTP instead.')));
      });

    function paint() {
      const place = data.places.find(p => p.id === current) || data.places[0];
      const days = forecast(place);
      const today = days[0];
      const ch = chapter();
      const isCampus = place.id === 'meridian';

      const picker = h('select.select', { style: { maxWidth: '14rem' }, 'aria-label': 'Place',
        onchange: e => { current = e.target.value; paint(); } },
        ...data.places.map(p => h('option', { value: p.id, selected: p.id === current }, p.name)));

      const strip = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: '.5rem' } },
        ...days.map((d, i) => h('div.card', { style: { textAlign: 'center', padding: '.75rem .4rem' } },
          h('div.small.dim', i === 0 ? 'Today' : d.date.toLocaleDateString('en-GB', { weekday: 'short' })),
          h('div', { style: { fontSize: '1.5rem', lineHeight: '1.6' } }, ICONS[d.cond]),
          h('div.mono.small', fmt(d.high, 0) + '°'),
          h('div.mono.small.dim', fmt(d.low, 0) + '°'),
          h('div.small.dim', d.pop + '%')
        )));

      mount(body,
        h('div.row', picker, h('span.spacer'),
          h('span.badge', 'offline reference')),
        h('div.card',
          h('div.row',
            h('div', { style: { fontSize: '3.4rem', lineHeight: '1' } }, ICONS[today.cond]),
            h('div',
              h('div', { style: { fontSize: '2.4rem', fontWeight: '600', fontVariantNumeric: 'tabular-nums' } }, fmt(today.high, 0) + '°C'),
              h('div.small.dim', place.name + ' · ' + place.region)),
            h('span.spacer'),
            h('dl.kv',
              h('dt', 'Low'), h('dd', fmt(today.low, 0) + '°'),
              h('dt', 'Rain'), h('dd', today.pop + '%'),
              h('dt', 'Humidity'), h('dd', today.humidity + '%'),
              h('dt', 'Wind'), h('dd', today.wind + ' km/h'))
          )
        ),
        strip,
        isCampus && ch >= 3
          ? h('div.card', { style: { borderColor: 'var(--warn)' } },
              h('h3', 'Indoor sensor attached to this location'),
              h('p.small', `The campus entry has an indoor reading bound to it, from ${RIG.room}. Outside it is ${fmt(today.high, 0)} degrees. Inside bay ${RIG.faultBay} it is ${fmt(liveTemp(), 1)}.`),
              h('p.small.dim', { style: { marginBottom: 0 } }, 'The room has no ventilation and no window. Nothing outside explains that number.'))
          : null,
        h('p.small.dim',
          `Built from monthly climate normals in assets/data/weather.json, last updated ${data.updated}. It is a reference, not a live forecast, so it never needs a key and never phones anywhere.`)
      );
    }
  }
};
