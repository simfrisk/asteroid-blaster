import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { circleHit, clamp, makeInitialState, pointInRect, terrainRects } from "./game.js";

describe("Captain Liivo core helpers", () => {
  it("clamps values to the requested range", () => {
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
    assert.equal(clamp(6, 0, 10), 6);
  });

  it("detects circular collisions at the boundary", () => {
    assert.equal(circleHit({ x: 0, y: 0, radius: 10 }, { x: 20, y: 0, radius: 10 }), true);
    assert.equal(circleHit({ x: 0, y: 0, radius: 10 }, { x: 21, y: 0, radius: 10 }), false);
  });

  it("detects point collisions with shifting terrain rectangles", () => {
    const rect = { x: 10, y: 20, width: 40, height: 30 };
    assert.equal(pointInRect({ x: 10, y: 20 }, rect), true);
    assert.equal(pointInRect({ x: 51, y: 25 }, rect), false);
  });

  it("creates a playable initial state", () => {
    const state = makeInitialState();
    assert.equal(state.mode, "ready");
    assert.equal(state.planet, 100);
    assert.equal(state.hull, 100);
    assert.equal(state.player.y > 500, true);
    assert.equal(state.stars.length > 50, true);
  });

  it("returns terrain layouts for all terrain modes", () => {
    assert.equal(terrainRects(0, 0).length >= 2, true);
    assert.equal(terrainRects(1, 1).length >= 2, true);
    assert.equal(terrainRects(2, 2).length >= 2, true);
  });
});
