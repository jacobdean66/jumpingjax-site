import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  billableModelProtectionBlock,
  getAgentProtectionMode,
  paidGenerationProtectionBlock,
} from "./agent-protection-mode";
import { createOpenAiJsonClient } from "./llm-json-client";
import { evaluateAgentComplianceGate } from "./agent-compliance-gate";
import { statusTransitionDecision } from "./status-transition-gate";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../../../..");

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}

/* ------------------------------------------------------------------ */
/* Objective A — process-local override hardening                      */
/* ------------------------------------------------------------------ */

test("A1: VERCEL_ENV=production + local override stays fail-closed", () => {
  const mode = getAgentProtectionMode(
    env({
      AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
    }),
  );
  assert.equal(mode.kind, "disabled");
  assert.ok(
    billableModelProtectionBlock(
      env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        VERCEL_ENV: "production",
      }),
    ),
  );
  assert.ok(
    paidGenerationProtectionBlock(
      env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        VERCEL_ENV: "production",
      }),
    ),
  );
});

test("A2: VERCEL_ENV=preview + local override stays fail-closed", () => {
  const mode = getAgentProtectionMode(
    env({
      AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
    }),
  );
  assert.equal(mode.kind, "disabled");
  assert.ok(
    billableModelProtectionBlock(
      env({ AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1", VERCEL_ENV: "preview" }),
    ),
  );
  // Override combined with test/dev NODE_ENV still cannot unlock a Vercel
  // deployment context.
  assert.equal(
    getAgentProtectionMode(
      env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        NODE_ENV: "test",
        VERCEL_ENV: "preview",
      }),
    ).kind,
    "disabled",
  );
  assert.equal(
    getAgentProtectionMode(
      env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        NODE_ENV: "development",
        VERCEL_ENV: "production",
      }),
    ).kind,
    "disabled",
  );
});

test("A3: supported safe local/test cases keep process-local aids", () => {
  assert.equal(
    getAgentProtectionMode(env({ NODE_ENV: "test" })).kind,
    "process-local-nonproduction",
  );
  assert.equal(
    getAgentProtectionMode(env({ NODE_ENV: "development" })).kind,
    "process-local-nonproduction",
  );
  assert.equal(
    getAgentProtectionMode(env({ AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1" }))
      .kind,
    "process-local-nonproduction",
  );
  // Vercel local development is affirmatively non-deployment.
  assert.equal(
    getAgentProtectionMode(
      env({ NODE_ENV: "development", VERCEL: "1", VERCEL_ENV: "development" }),
    ).kind,
    "process-local-nonproduction",
  );
});

test("A4: malformed or ambiguous production-like contexts fail closed", () => {
  // Missing everything.
  assert.equal(getAgentProtectionMode(env({})).kind, "disabled");
  // Malformed NODE_ENV.
  assert.equal(getAgentProtectionMode(env({ NODE_ENV: "prod" })).kind, "disabled");
  // Ambiguous: on Vercel but VERCEL_ENV missing — even with override.
  assert.equal(
    getAgentProtectionMode(
      env({ AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1", VERCEL: "1" }),
    ).kind,
    "disabled",
  );
  // Ambiguous: on Vercel with an unrecognized VERCEL_ENV value.
  assert.equal(
    getAgentProtectionMode(
      env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        VERCEL: "1",
        VERCEL_ENV: "staging",
      }),
    ).kind,
    "disabled",
  );
  assert.equal(
    getAgentProtectionMode(
      env({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).kind,
    "disabled",
  );
});

test("A5: blocked execution makes zero provider calls even with the override set", async () => {
  let fetchCalls = 0;
  const spyFetch: typeof fetch = async () => {
    fetchCalls += 1;
    return new Response("{}", { status: 200 });
  };

  for (const vercelEnv of ["production", "preview"]) {
    const client = createOpenAiJsonClient({
      apiKey: "sk-test-not-a-real-key",
      fetchImpl: spyFetch,
      env: env({
        AGENT_ALLOW_PROCESS_LOCAL_PROTECTION: "1",
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: vercelEnv,
      }),
    });
    const result = await client.completeJson({ system: "s", user: "u" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.blockedByProtection, true);
    }
  }
  assert.equal(fetchCalls, 0);
});

/* ------------------------------------------------------------------ */
/* Objective B — resulting authoritative media_type                    */
/* ------------------------------------------------------------------ */

const CLEAN_CONTENT = {
  title: "Backyard bounce fun",
  caption: "Family fun with our bounce houses in Greenwood.",
  generationPrompt: "Bright backyard, kids bouncing, no text on screen.",
  campaignId: "summer-water-slides",
  platforms: ["facebook"] as const,
  posts: [] as const,
};

test("B1: media_type changes deterministic compliance treatment for identical content", () => {
  const asImage = evaluateAgentComplianceGate({
    ...CLEAN_CONTENT,
    mediaType: "image",
    candidateId: "explicit:test:media-image",
  });
  const asVideo = evaluateAgentComplianceGate({
    ...CLEAN_CONTENT,
    mediaType: "video",
    candidateId: "explicit:test:media-video",
  });

  // Identical text, different media rules: the evaluated findings differ
  // (image triggers alt-text + image-only-claims gaps; video triggers the
  // captions/transcript gap), so evaluating the wrong media_type would gate
  // against the wrong rule set.
  assert.notDeepEqual(asImage.blockingCodes, asVideo.blockingCodes);
  assert.notEqual(asImage.summary, asVideo.summary);

  // Both remain fail-closed here (no allow) — media_type never weakens the
  // gate for this fixture.
  assert.notEqual(asImage.decision, "allow");
  assert.notEqual(asVideo.decision, "allow");

  // And an approval-ready transition is denied under both evaluations.
  assert.equal(
    statusTransitionDecision({ requestedStatus: "approved", compliance: asImage })
      .eligible,
    false,
  );
  assert.equal(
    statusTransitionDecision({ requestedStatus: "approved", compliance: asVideo })
      .eligible,
    false,
  );
});

test("B2: combined PATCH compliance evaluates the RESULTING media_type (route wiring)", () => {
  const src = readFileSync(
    path.join(ROOT, "src/app/api/social-posts/[id]/route.ts"),
    "utf8",
  );

  // Helper exists and prefers the requested value over the stored one.
  assert.match(src, /function resolveResultingMediaType\(/);
  const helper = src.slice(src.indexOf("function resolveResultingMediaType"));
  assert.match(
    helper.slice(0, 400),
    /requested \|\| stored/,
  );

  // Manual-PATCH compliance call uses the resulting media type, not the
  // stored-only value.
  const patchComplianceIdx = src.indexOf("explicit:manual-patch:");
  const patchWindow = src.slice(patchComplianceIdx - 700, patchComplianceIdx);
  assert.match(patchWindow, /resolveResultingMediaType\(/);
  assert.doesNotMatch(patchWindow, /mediaType: existingForPatch\.media_type/);

  // Regenerate compliance call also uses the resulting media type for
  // non-regenerate_all actions.
  const regenComplianceIdx = src.indexOf("explicit:regenerate:");
  const regenWindow = src.slice(regenComplianceIdx - 900, regenComplianceIdx);
  assert.match(regenWindow, /resolveResultingMediaType\(/);
  assert.doesNotMatch(regenWindow, /mediaType:\s*existing\.media_type/);

  // Client compliance/eligibility claims still never read.
  assert.doesNotMatch(src, /body\.compliance/);
  assert.doesNotMatch(src, /body\.allowedToProceed/);
  assert.doesNotMatch(src, /body\.generationReady/);
});

test("B3: old/new media_type regression — switching type re-gates against the new rule set", () => {
  // A post stored as image being switched to video with an approval-ready
  // status must be judged as video: the video evaluation carries the
  // captions-gap blocking code that the stale image evaluation would miss.
  const resultingVideo = evaluateAgentComplianceGate({
    ...CLEAN_CONTENT,
    mediaType: "video",
    candidateId: "explicit:test:switch-to-video",
  });
  const staleImage = evaluateAgentComplianceGate({
    ...CLEAN_CONTENT,
    mediaType: "image",
    candidateId: "explicit:test:stale-image",
  });
  assert.notDeepEqual(resultingVideo.blockingCodes, staleImage.blockingCodes);

  const denial = statusTransitionDecision({
    requestedStatus: "scheduled",
    compliance: resultingVideo,
  });
  assert.equal(denial.eligible, false);
});
