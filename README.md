# Captain Liivo

A small browser arcade game built from the paper sketch in `IMG_2465.jpeg`.

## Play

```bash
npm start
```

Open `http://127.0.0.1:4173`.

## Verify

```bash
npm run build
```

The build script syntax-checks the server and game code, then runs the Node test suite.

## Game Shape

- Rocket shuttle moves vertically and horizontally.
- UFO fires lasers from the upper-left flight path.
- Captain Liivo asteroids drift toward the ringed planet.
- The rocket fires lasers, collects speed powerups, and survives shifting terrain bands.
- The HUD tracks score, planet integrity, hull, and terrain state.

## Liivo Notes

This repo is a single deployable app with root scripts:

- `npm run build`
- `npm start`

No environment variables or external services are required.
