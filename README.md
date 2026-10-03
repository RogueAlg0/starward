# Starward

A single-player starship captain sim. You manage, you never pilot.

Draft a crew, pick contracts, set doctrine, and watch voyages resolve day by
day while the captain's log writes itself. Captains age, retire, and die;
heirs take the chair and the chronicle continues. Every scar on the hull is
remembered.

## Stack

- [Vite](https://vite.dev/) + TypeScript (strict) + Tailwind CSS
- No runtime dependencies in the browser: the production build is a single
  self-contained `dist/index.html` (via `vite-plugin-singlefile`)
- Zero external assets: all art is procedural (seeded SVG + canvas + ASCII)

## Scripts

```sh
npm install     # install dependencies
npm run dev     # start the dev server (hot reload)
npm run build   # typecheck (tsc --noEmit) + production build into dist/
npm run preview # serve the production build locally
```

Saves live in `localStorage` (`starward.save.v1`) and can be exported or
imported as JSON from the Ship screen's Dynasty panel.

## Project layout

```
index.html            # entry: #stars canvas, #app, #toast
src/main.ts           # init, delegated event handling, __sw test hooks
src/types.ts          # shared types (the save format)
src/game/             # simulation: rng, data, state/saves, crew, log,
                      # voyage engine + events, station, captain/dynasty,
                      # contracts, commission
src/art/              # procedural art: ship sigils, crew identicons,
                      # canvas starfield, star map + ship schematic + ASCII
src/ui/               # screens, shell (header/tabs/render), log entries
src/index.css         # Tailwind entry
src/terminal.css      # deep-space-terminal aesthetic
```

## Art direction

The signature visual identity is SVG and ASCII, seeded and geometric,
in a phosphor-gold/cyan terminal palette:

- Seeded SVG ship sigils (hull-specific cores, range rings, registry numbers)
- Geometric crew identicons (mirrored 5x5 marks, one per soul)
- An SVG **star map** on the contract board: known space with risk-colored routes
- A large SVG **ship schematic** on the ship screen: battle damage numbered in
  red, quirks marked in gold, segmented hull-integrity bar
- **ASCII sector charts** logged at every departure, ASCII dividers in the log
- A seeded canvas starfield with procedural nebulae behind everything

## itch.io upload notes

The game is a static site with no backend.

1. Run `npm run build`.
2. Upload `dist/index.html` to itch.io via **"Upload files"**, or zip the
   `dist/` folder and upload the zip.
3. In the itch.io edit page, set **"Kind of project"** to **HTML** and tick
   **"This file will be played in the browser"**.
4. Set the viewport size (960x640 works well); the layout is phone-readable
   and the star map / schematic scroll horizontally on narrow screens.
5. Because `vite.config.ts` sets `base: './'` and everything is inlined,
   the build also works from `file://` and any static host.

## Port notes

This is a faithful TypeScript port of the vanilla JS prototype
(`../starward/`). Behavior differences are deliberate and small:

- Crew identicons were non-deterministic in the prototype (regenerated on
  every render); they are now seeded and stable per crew member.
- The prototype's `toast()` was a silent no-op (no `#toast` element in its
  HTML); the element now exists, so toasts actually appear.
- Inline `onclick` handlers became `data-action`/`data-input` attributes
  with delegated listeners (cleaner under TypeScript, same behavior).
- New signature art: star map, ship schematic, ASCII sector charts in the log.
