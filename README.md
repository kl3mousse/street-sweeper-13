# Street Sweeper 13 (webxdc)

An open-source word-collection game where you control a street sweeper to collect letters and spell French words while avoiding obstacles.

## Credits

This game is a small *clin d'œil* to **ULIS** by Fabien Toulmé (Delcourt, 2025).  
If you enjoyed it, consider supporting independent booksellers by picking up the book:

- [Éditions Delcourt (publisher’s page)](https://www.editions-delcourt.fr/bd/series/serie-ulis/album-ulis)  
- [LesLibraires.fr](https://www.leslibraires.fr/livre/24520936-ulis-fabien-toulme-delcourt)  
- [Librest](https://www.librest.com/livres/ulis-fabien-toulme_0-12492854_9782413088165.html)  
- [Place des Libraires](https://www.placedeslibraires.fr/livre/9782413088165-ulis-fabien-toulme/)  

*These are not affiliate links. Please avoid Amazon and other monopolies — choose independents whenever you can.*

Game art is inspired by [Jibé Pollien](https://www.chezjibe.com/) pixel art from the book above.
Road art is taken from Dylan Macgillavry on [Art Station](https://www.artstation.com/artwork/0nxqyG)

## How to Play
- **Goal**: Collect letters in the correct order to spell words before time runs out
- **Controls**: 
  - Arrow Up/Down: Move between 3 lanes
  - Touch: Tap top/bottom half of screen to move
- **Scoring**: +100 per correct letter, +500 per completed word
- **Hazards**: Wrong letters and obstacles cost lives and time

## Game Features
- 45-second rounds with time bonuses/penalties
- 3 lives system with broom emoji indicators
- Level progression through different cities (every 10 words)
- Increasing difficulty as you advance
- Best score tracking

## Files
- `index.html` — Game UI and canvas
- `styles.css` — Styling and canvas scaling
- `main.js` — Complete game logic
- `manifest.toml` — webxdc metadata
- `AGENTS.md` — Technical documentation for AI agents

## Run Development Server
```sh
# Install webxdc-dev (once)
npm install -g webxdc-dev

# Start dev server
webxdc-dev
```

Or use any static server:

```sh
python3 -m http.server 8000
```

Then open `http://<your-computer-ip>:8000/` on your Android device (both on the same Wi‑Fi).

## Package for webxdc
```sh
# Create .xdc file
zip -9r street-sweeper-13.xdc index.html styles.css main.js manifest.toml
```

Share the `.xdc` file in any WebXDC-compatible chat app.

## Debug Mode
Set `DEBUG = true` at the top of `main.js` to see entity counts and collision boxes.

## Troubleshooting (Android/Chrome)
- If the start/credits buttons appear unstyled at the top or don't respond, avoid opening the files directly with `file://` on mobile. Serve the folder over HTTP (see above) to ensure CSS/JS load correctly.
- If taps don’t seem to register, hard‑refresh the page and clear site data: Settings → Site settings → Storage → Clear for this site.
- Some environments can block `localStorage`. We've added guards, but if best score doesn’t persist, it may be disabled on your device/browser profile.