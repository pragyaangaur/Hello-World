<h1>Hello World</h1>

<p><strong>A simple to-do list app.</strong></p>

<p>Add a task. Tick it off. That's it.</p>

**[Open Hello World →](https://pragyaangaur.github.io/Hello-World/)**

---

## What it does

- **Tasks that stay put.** Add, edit, complete, delete, undo. Filter by what's
  left. Everything saves as you type.
- **Works offline.** There is no server, no account, and no sign-up. Your tasks
  live in your browser and go nowhere else.
- **No tracking.** No analytics, no cookies, no third-party requests. Not one.
- **Light and dark.** Follows your system, or pick one in Settings.
- **Keyboard friendly.** Tab through everything, edit in place, and the focus
  ring always tells you where you are.
- **A toolbox.** Twenty-nine small utilities we built while learning and could
  not bring ourselves to delete. A calculator, a unit converter, a sketchpad,
  an oscilloscope, a pendulum, a beam load solver, and a few games.

## Running it locally

There is no build step and there are no dependencies. Clone it and serve the
folder over HTTP.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` straight from disk will not
work, because browsers block ES modules and `fetch` on `file://`.

## Deploying

It is a static site, so GitHub Pages needs no workflow. In **Settings → Pages**,
set the source to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
The `.nojekyll` file is already there so nothing gets filtered.

## How it is built

Plain HTML, CSS, and JavaScript modules. No framework, no bundler, no
`package.json`.

```
index.html            the shell
404.html              for links that miss
assets/css/           tokens, layout, components
assets/js/core/       state, storage, router, event bus, DOM helpers
assets/js/modules/    one file per tool
assets/js/ui/         pages
assets/data/          offline reference data
```

Routing is hash based, so deep links like `#/tools/calculator` survive a static
host with no rewrite rules. Every asset path is relative, so the site works from
a project subpath as happily as from a custom domain.

## A note on the toolbox

Some of the tools have a story attached to them. You will find it if you keep
using the app. There is a content notice on first launch and a calm mode in
Settings that turns off every effect and sound while leaving everything else
alone.

## Built by

Pragyaan Gaur, and two people who kept saying "just one more tool".

## Licence

MIT. See [LICENSE](LICENSE).
