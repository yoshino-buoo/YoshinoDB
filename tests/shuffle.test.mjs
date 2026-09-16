import { test } from "node:test";
import assert from "node:assert/strict";
import { createShuffleCycle } from "../lib/shuffle.js";

test("each shuffled round includes every track once, with no adjacent repeats across rounds", () => {
  const tracks = Object.freeze(["hibi", "inori", "sakura"]);
  for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
    const next = createShuffleCycle(tracks, () => value);
    let previous;
    for (let round = 0; round < 20; round++) {
      const played = [];
      for (let i = 0; i < tracks.length; i++) {
        const song = next();
        assert.notEqual(song, previous);
        played.push(song);
        previous = song;
      }
      assert.deepEqual(played.sort(), [...tracks].sort());
    }
  }
});

test("a new visit can begin with any song, and a one-track playlist remains playable", () => {
  const tracks = ["hibi", "inori", "sakura"];
  const first = [0, 0.4, 0.999].map((value) =>
    createShuffleCycle(tracks, () => value)(),
  );
  assert.equal(new Set(first).size, tracks.length);
  const solo = createShuffleCycle(["hibi"]);
  assert.equal(solo(), "hibi");
  assert.equal(solo(), "hibi");
  assert.throws(() => createShuffleCycle([]));
});
