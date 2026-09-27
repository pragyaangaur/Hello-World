# Hello World

Context for anyone, human or AI, picking this up cold. Written 4 September 2026.

The folder on disk is "Basic-ly". The project is Hello World.

**`CONTRIBUTING.md` in this repository is the detailed working guide and is excellent. Read it before changing anything.** This file gives the surrounding context that guide does not: the history, the status, and who worked on it. Note that CONTRIBUTING.md carries a spoiler warning, and so does this file. If somebody has not played it, send them to the app.

## What it is

It opens as a to-do list and it is a to-do list the whole way through. There is a machine on a lab bench that has been writing tasks into this list every morning for two years, and for the last nineteen days those tasks have been about a battery pack getting hotter. Nobody has read any of them. The only way to talk back is to write a task of your own, because a list is the only thing the machine can read.

The game is eight acts. Each is a puzzle solved with one tool from the Toolbox, and the answer is always written on the list.

- Repo: https://github.com/pragyaangaur/Hello-World
- Live: https://pragyaangaur.github.io/Hello-World/
- Stack: plain HTML, CSS and ES modules. No build step, no dependencies, no server, no network request anywhere in the app.

## Who built it

Pragyaan Gaur with Arkapravo Pal, Suvam Samanta and Nishchay Singh. This is the only collaborative project in the collection, so changes here affect other people.

## Status

**Update, 23 September 2026.** The folder now lives at `~/Claude Code Projects/Basic-ly`, not in the home folder. The last commit is `0ec7540 Contributors changed` on 6 September 2026. Nothing is in progress.

Shipped and polished. The last commit is `3176640 docs: write down the state merge and the restore signal` on 2 September 2026. The tree is clean.

Development ran from 29 August to 2 September 2026. The shape of the history is worth knowing: a build-out phase, then a merged feedback pass (`eff4306`, pull request #1), then a long run of small fixes for edges that only show up when real people play. Several tools were deliberately deleted rather than kept as filler.

## Layout

```
assets/js/core/      state, storage, routing, the event bus, tasks, notify, audio, DOM helpers
assets/js/modules/   24 tools, one file each, plus index.js which registers them
assets/js/story/     acts, engine, dialogue, cast, rig, residue, atmosphere, archive,
                     accounts, interlude, live
assets/js/ui/        the pages: tasks, toolbox, bench, console, settings, ending, shell
assets/css/          tokens, base, layout, components, modules, terminal
assets/data/         weather.json
index.html, card.html, 404.html
.claude/devserve.py  the static dev server
```

## The rules that hold the design together

These come out of the history and out of CONTRIBUTING.md. Breaking any of them is how this codebase goes wrong.

- **Tools do not know there is a story.** A tool renders itself and announces any interesting value on the bus with `emit('tool:value', {...})`. The story engine listens. Nothing breaks if nothing listens. A few tools read `chapter()` near the top of `mount`, and that is the one concession.
- **Return a cleanup function from `mount` if you started anything that keeps running.** A timer, an animation frame, an audio node, or a listener on `window`. Element listeners die with the element; window listeners do not, and forgetting one is the most common bug here. Two commits fixed exactly this, in the orbital simulator and the scope.
- **All state lives in one object in `core/state.js`**, saved under a single localStorage key. A saved file is merged over the defaults one level down as well as at the top, so a player from before your field existed gets your default rather than `undefined`. Keep the shape shallow. Arrays and plain values come straight from the saved file; only objects merge key by key.
- **A restored task is not a new task.** Undo goes through `restore` in `core/tasks.js` and announces `task:restore`, not `task:add`, because the story engine reads a user task landing on the list as the player speaking. Anything redrawing on `task:add` must listen for `task:restore` too.
- **Answers are lines, not substrings.** An act that fires on any line containing its answer will skip the puzzle when the player was only talking. Copy the shape of `isAnswerWord` in `acts.js`.
- **Every date is worked out from the day the player opens the app.** Never type a date or a day count into a string.
- **Reduced motion is checked by every sudden effect**, and the game plays identically without any of them. Flashes stay at one every few minutes and fade over most of a second, which keeps the page well under the rate that troubles photosensitive people.
- **The story machine must never be left unable to answer.** Two commits exist because a thrown error in a reply handler stranded the player. Guard the handlers.

## Style

Comments explain why, not what. Prose in commits, pull requests and markdown is plain simple English with no em dashes and no one-sentence paragraphs. Commit subjects stay under about 72 characters.

## Running it

```bash
python3 .claude/devserve.py 8125
```

Then open `http://localhost:8125`. Any static server works, but you need one, because ES modules will not load over `file://`. Add `?debug` for a chapter jumper and a state dump.
