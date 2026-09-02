# Working on Hello World

Read this before you change anything. It is short, and it will save you from the two or three mistakes that are easy to make here.

**Spoiler warning.** The rest of this file describes how the app actually works, which gives the whole thing away. If somebody has not played it yet, send them to the app and not to this page.

## Running it

There is no build step and there are no dependencies. Every file in the repository is served exactly as it is written. You need a static file server because the app is made of ES modules, and browsers will not load those over `file://`.

```bash
python3 .claude/devserve.py 8125
```

Then open `http://localhost:8125`. Any static server works. Editing a file and reloading the page is the whole development loop.

Add `?debug` to the URL for a chapter jumper in the bottom left corner, which also has a button that dumps the saved state.

## What it is

It opens as a to-do list and it is a to-do list the whole way through. There is a machine on a lab bench that has been writing tasks into this list every morning for two years, and for the last nineteen days those tasks have been about a battery pack getting hotter. Nobody has read any of them. The only way to talk back is to write a task of your own, because a list is the only thing the machine can read.

The game is eight steps. Each one is a puzzle solved with one tool from the Toolbox, and the answer is always written on the list.

## How the code is laid out

```
assets/js/core/      state, storage, routing, the event bus, DOM helpers
assets/js/modules/   the tools, one file each, plus index.js which registers them
assets/js/story/     everything that knows there is a story
assets/js/ui/        the pages: tasks, toolbox, bench, console, settings, ending
```

The important rule is the direction of the arrows. **Tools do not know there is a story.** A tool renders itself and, if it produces a value somebody might care about, it announces that on the bus:

```js
emit('tool:value', { tool: 'dice', value: 5 });
```

The story engine listens. The tool has no idea whether anything is listening, and nothing breaks if nothing is. A few tools read `chapter()` to decide what to show, which is the one concession, and it is always a small branch near the top of `mount`.

Everything that survives a reload lives in one object in `core/state.js`, saved to a single localStorage key. There is no server and no network request anywhere in the app.

## The saved state

Add a new field by putting it in `DEFAULTS` in `core/state.js`, and that is all. A saved file is merged over the defaults one level down as well as at the top, so somebody who has been playing since before your field existed gets your default rather than `undefined`. That merge is the reason a new setting can be added without a migration, so keep the shape shallow. Arrays and plain values come straight from the saved file, and only objects are merged key by key.

Settings can be exported and imported from the Settings page. Import replaces the whole object, so anything you add is carried between browsers for free, and anything you add that only makes sense on one machine should be put back the way `installedAt` is.

## Adding a tool

Write `assets/js/modules/yourtool.js`:

```js
import { h, mount } from '../core/dom.js';

export default {
  id: 'yourtool',
  name: 'Your tool',
  dept: 'Everyday',      // must be one of DEPT_ORDER in index.js
  icon: '◆',
  chapter: 1,            // the earliest chapter it appears in the Toolbox
  blurb: 'One short line',
  wide: false,           // true gives it the wider page

  mount(root) {
    mount(root, h('div.card', 'hello'));
    // Return a cleanup function if you started anything that keeps running.
    return () => {};
  }
};
```

Then import it in `modules/index.js` and add it to the `registry` array. That is the whole registration.

**If your tool starts a timer, an animation frame, an audio node, or a listener on `window`, return a function that stops it.** The toolbox calls it when the player leaves. Element listeners die with the element and need no cleanup. Listeners on `window` do not, and forgetting one is the most common bug in this codebase. There is a leak of exactly this kind in the history of the orbital simulator if you want to see what it looks like.

## The story files

- `acts.js` is the spine. Eight acts, each with a goal, the tools it needs, and either an `answer(text)` for a line the player writes or a `listen` for a value a tool reports. The beats are here too, and each one is a picture, a number, and at most two sentences.
- `engine.js` listens to the list and to the tools, checks answers, and writes back.
- `dialogue.js` is everything the machine can say to a line that is not an answer. Topics are matched in order, first match wins, and each topic carries one reply per voice. It speaks in three voices and drifts from a log line to plain sentences as the game goes on.
- `cast.js` holds the people, the rig, and the clock. **Every date is worked out from the day the player opens the app**, so the gaps always read as real gaps. Do not type a date or a day count into a string anywhere.
- `rig.js` draws the bench and owns the live temperature.
- `residue.js` is what the four people who used this machine left in each tool.
- `atmosphere.js` is the room: colour, grain, sound, and the things that make a person look up.

## Three things to be careful with

**Reduced motion.** Every sudden effect checks `prefers-reduced-motion` and turns itself off. The game plays identically without any of them. If you add an effect, it goes through the same check. Flashes are kept to one every few minutes and fade over most of a second, which keeps the page well under the rate that causes trouble for photosensitive people.

**A restored task is not a new task.** Deleting a task and undoing it goes through `restore` in `core/tasks.js`, which puts the original back with its own id, its own place in the list and its own ticked state. It announces itself as `task:restore` rather than `task:add`, because the story engine reads a user task landing on the list as the player saying something, and a line they are only putting back is not them saying it twice. Anything that redraws on `task:add` should listen for `task:restore` too.

**Answers are lines, not substrings.** An act that accepts any line containing its answer will fire on a sentence where the player was talking, skip the puzzle, and move the game on before they worked anything out. `isAnswerWord` in `acts.js` shows the shape to copy.

## Style

Comments explain why, not what. Prose in commits, pull requests and markdown is plain simple English with no em dashes and no one-sentence paragraphs. Commit subjects stay under about 72 characters.
