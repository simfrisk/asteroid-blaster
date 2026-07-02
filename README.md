# Captain Liivo

A browser space shooter built from a hand-drawn napkin sketch, built and deployed with [Liivo](https://www.liivo.ai) on [Eyevinn Open Source Cloud](https://www.osaas.io).

Suit up, Captain. Dodge drifting asteroids, blast UFOs, and grab glowing power-ups for a rapid-fire spread.

## Controls
- Move: `W A S D` or arrow keys
- Fire: `Space` or hold click
- Mobile: drag to move, ship auto-fires

## Run locally
```
npm start
```
Then open http://localhost:8080

The whole game is a single self-contained `index.html` (HTML5 canvas, no dependencies). `server.js` just serves it on `process.env.PORT`.
