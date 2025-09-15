# Street Sweeper 13 (webxdc)

A minimal, self-contained webxdc game scaffold. It shows an empty canvas with three UI states (start, game, over) and transitions via simple buttons.

## Files
- `index.html` — HTML with start/game/over screens and the `<canvas id="game" width="320" height="180">`.
- `styles.css` — Centers the canvas, sets pixelated rendering.
- `main.js` — GameState enum, basic requestAnimationFrame loop clearing the canvas each frame.
- `manifest.toml` — Minimal metadata for webxdc packaging.

## Preferred: run with webxdc-dev
If you use `webxdc-dev`, you’ll get a quick-refresh preview and packaging helpers.

Install once (global) or use npx on demand:

```sh
# Global install (recommended if you use it often)
npm install -g webxdc-dev

# Or run without installing globally
npx webxdc-dev
```

From this folder, start the dev server:

```sh
webxdc-dev
```

That will open a local preview. The server watches for changes and reloads.

### npm scripts (optional)
This repo includes a `package.json` with helpful scripts:

```sh
# Start dev server
npm run dev

# Package .xdc file
npm run pack
```

If you don’t want Node/npm tooling, see the manual run/packaging below.

## Run manually (no tooling)
You can also open `index.html` directly in your browser. No server or dependencies are required.

## Package for webxdc (manual)
Create a `.xdc` by zipping these files (flat, without extra folder nesting) and renaming the zip to `.xdc`:

```sh
# From the project directory
zip -9r street-sweeper-13.xdc index.html styles.css main.js manifest.toml
```

Then share `street-sweeper-13.xdc` in a WebXDC-compatible chat app.

## Next steps
- Add input handling and actual gameplay.
- Draw simple pixel art and sprites.
- Persist high scores using `webxdc.storage` if desired.