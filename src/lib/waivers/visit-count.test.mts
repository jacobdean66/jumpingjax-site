import assert from "node:assert/strict";
import test from "node:test";

import { legacyVisitCount, visitCountsByParticipant } from "./visit-count";

test("counts each completed attendance row for its participant", () => {
  const counts = visitCountsByParticipant(
    [
      { participantId: "thor" },
      { participantId: "thor" },
      { participantId: "loki" },
    ],
    (row) => row.participantId,
  );

  assert.equal(counts.get("thor"), 2);
  assert.equal(counts.get("loki"), 1);
  assert.equal(counts.get("unknown") ?? 0, 0);
});

test("legacy visit totals include imported and dashboard check-ins", () => {
  assert.equal(legacyVisitCount(["2025-01-10", "2025-02-12"], 3), 5);
});
