import assert from "node:assert/strict";
import test from "node:test";

import { resolveInvitationSourceTreatment } from "./source-treatment.ts";

test("specific entered themes retain a matching visual identity", () => {
  assert.equal(resolveInvitationSourceTreatment("Sonic")?.id, "speedster-blue");
  assert.equal(
    resolveInvitationSourceTreatment("Sonic birthday party")?.id,
    "speedster-blue",
  );
  assert.equal(resolveInvitationSourceTreatment("Minecraft")?.id, "block-world");
  assert.equal(resolveInvitationSourceTreatment("Camouflage")?.id, "camouflage");
  assert.equal(resolveInvitationSourceTreatment("Camoflauge")?.id, "camouflage");
  assert.equal(resolveInvitationSourceTreatment("Transformers")?.id, "transforming-robots");
  assert.equal(resolveInvitationSourceTreatment("Spider-Man")?.id, "web-hero");
  assert.equal(resolveInvitationSourceTreatment("Barbie")?.id, "pink-fashion");
});

test("generic library themes continue using their curated artwork", () => {
  assert.equal(resolveInvitationSourceTreatment("sports"), null);
  assert.equal(resolveInvitationSourceTreatment("princess"), null);
  assert.equal(resolveInvitationSourceTreatment("dinosaurs"), null);
});
