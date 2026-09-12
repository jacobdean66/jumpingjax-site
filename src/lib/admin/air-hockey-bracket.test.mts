import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAirHockeyBracket,
  setAirHockeyMatchWinner,
  updateFirstRoundAssignments,
} from "./air-hockey-bracket";

const players = [
  { id: "p1", name: "Avery" },
  { id: "p2", name: "Blake" },
  { id: "p3", name: "Casey" },
];

test("builds a bracket with byes for non-power-of-two player counts", () => {
  const bracket = buildAirHockeyBracket(players, new Date("2026-09-12T12:00:00Z"));

  assert.equal(bracket.rounds[0].length, 2);
  assert.equal(bracket.rounds[1].length, 1);
  assert.equal(bracket.rounds[0][1].slot2.isBye, true);
  assert.equal(bracket.rounds[0][1].winnerId, "p3");
  assert.equal(bracket.rounds[1][0].slot2.playerId, "p3");
});

test("advances selected match winners into the next round and champion slot", () => {
  let bracket = buildAirHockeyBracket(players);

  bracket = setAirHockeyMatchWinner(bracket, "r1m1", "p2");
  assert.equal(bracket.rounds[1][0].slot1.playerId, "p2");

  bracket = setAirHockeyMatchWinner(bracket, "r2m1", "p3");
  assert.equal(bracket.championId, "p3");
});

test("allows first-round reassignment without duplicate players", () => {
  const bracket = buildAirHockeyBracket(players);
  const updated = updateFirstRoundAssignments(
    bracket,
    ["p3", "p1", "p2", null],
    players,
  );

  assert.equal(updated.rounds[0][0].slot1.playerId, "p3");
  assert.equal(updated.rounds[0][0].slot2.playerId, "p1");
  assert.equal(updated.rounds[0][1].slot1.playerId, "p2");
  assert.equal(updated.rounds[0][1].slot2.isBye, true);
  assert.throws(() =>
    updateFirstRoundAssignments(bracket, ["p1", "p1", "p2", null], players),
  );
});
