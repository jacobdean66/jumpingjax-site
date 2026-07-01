import assert from "node:assert/strict";

import {
  buildSocialPublicationExecutionRunbook,
  detectForbiddenRunbookState,
  hydrateSocialPublicationExecutionRunbook,
  serializeSocialPublicationExecutionRunbook,
  validateSocialPublicationExecutionRunbook,
  type SocialPublicationExecutionRunbookStep,
} from "./social-publication-execution-runbook";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function satisfiedStep(
  kind: SocialPublicationExecutionRunbookStep["kind"],
  order: number,
): SocialPublicationExecutionRunbookStep {
  return {
    stepId: `step-${kind}`,
    order,
    kind,
    label: kind,
    description: `${kind} description`,
    required: true,
    satisfied: true,
    blocksRunbook: false,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function referenceRunbookInput() {
  return {
    runbookId: "runbook-job-a",
    executionJobId: "execution-job-a",
    executionIntentId: "execution-intent-a",
    createdAt: "2026-07-01T12:00:00.000Z",
    steps: [
      satisfiedStep("verify_preflight_pass", 1),
      satisfiedStep("verify_planner_ready", 2),
      satisfiedStep("verify_adapter_available", 3),
      satisfiedStep("verify_dry_run_capable", 4),
      satisfiedStep("verify_owner_authority", 5),
      satisfiedStep("verify_publisher_authority", 6),
      satisfiedStep("manual_operator_review", 7),
      satisfiedStep("manual_channel_confirmation", 8),
      satisfiedStep("manual_content_verification", 9),
      satisfiedStep("audit_evidence_capture", 10),
    ],
    operatorChecklist: [
      {
        itemId: "preflight-pass",
        label: "Preflight pass confirmed",
        category: "preflight" as const,
        required: true,
        satisfied: true,
        computedOnly: true as const,
        readOnly: true as const,
      },
    ],
    manualConfirmations: [
      {
        confirmationId: "operator-readiness-review",
        label: "Operator readiness review",
        description: "Human operator must review readiness.",
        requiredBeforeExecution: true as const,
        operatorMustConfirm: true as const,
        automatedConfirmationForbidden: true as const,
        computedOnly: true as const,
        readOnly: true as const,
        grantsExecutionPermission: false as const,
      },
    ],
    adapterPrerequisites: [
      {
        prerequisiteId: "adapter-contract",
        label: "Reference adapter contract available",
        present: true,
        required: true as const,
        computedOnly: true as const,
        readOnly: true as const,
      },
    ],
    preflightPrerequisites: [
      {
        prerequisiteId: "preflight-owner_approval",
        label: "Owner approval reference present",
        present: true,
        required: true as const,
        computedOnly: true as const,
        readOnly: true as const,
      },
    ],
    rollbackNotes: [
      {
        noteId: "rollback-note-a",
        label: "No execution occurred",
        guidance: "Nothing executed; no rollback required.",
        referenceOnly: true as const,
        executesNothing: true as const,
        mutatesNothing: true as const,
      },
    ],
    auditExpectations: [
      {
        expectationId: "audit-authority-chain",
        label: "Authority chain auditable",
        description: "Authority references remain traceable.",
        required: true as const,
        referenceOnly: true as const,
        computedOnly: true as const,
        readOnly: true as const,
      },
    ],
  };
}

await test("builds a ready runbook when prerequisites are satisfied", () => {
  const runbook = buildSocialPublicationExecutionRunbook(referenceRunbookInput());
  assert.equal(runbook.status, "ready");
  assert.equal(runbook.grantsExecutionPermission, false);
  assert.equal(runbook.automationForbidden, true);
  assert.equal(runbook.humanVerificationRequired, true);
});

await test("blocks runbooks with unsatisfied required steps and checklist items", () => {
  const input = referenceRunbookInput();
  const runbook = buildSocialPublicationExecutionRunbook({
    ...input,
    steps: input.steps.map((step) =>
      step.kind === "verify_preflight_pass"
        ? { ...step, satisfied: false, blocksRunbook: true }
        : step,
    ),
    operatorChecklist: input.operatorChecklist.map((item) => ({
      ...item,
      satisfied: false,
    })),
    adapterPrerequisites: input.adapterPrerequisites.map((prerequisite) => ({
      ...prerequisite,
      present: false,
    })),
  });

  assert.equal(runbook.status, "blocked");
  assert.ok(runbook.blockedReasons.includes("step_unsatisfied:verify_preflight_pass"));
  assert.ok(runbook.blockedReasons.includes("checklist_incomplete:preflight-pass"));
  assert.ok(runbook.blockedReasons.includes("adapter_prerequisite_missing:adapter-contract"));
});

await test("validates and serializes runbooks", () => {
  const runbook = buildSocialPublicationExecutionRunbook(referenceRunbookInput());
  const validation = validateSocialPublicationExecutionRunbook(runbook);
  assert.equal(validation.valid, true);

  const serialized = serializeSocialPublicationExecutionRunbook(runbook);
  const hydrated = hydrateSocialPublicationExecutionRunbook(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.runbookId, runbook.runbookId);
    assert.equal(hydrated.value.executesNothing, true);
  }
});

await test("detects forbidden automation and execution permission flags", () => {
  const runbook = buildSocialPublicationExecutionRunbook(referenceRunbookInput());
  const forbidden = detectForbiddenRunbookState({
    ...runbook,
    grantsExecutionPermission: true as unknown as false,
  });
  assert.equal(forbidden.forbidden, true);
  assert.ok(
    forbidden.diagnostics.some((diagnostic) => diagnostic.code === "forbidden_execution_permission"),
  );
});

await test("rejects invalid runbook hydration", () => {
  const hydrated = hydrateSocialPublicationExecutionRunbook("{not-json");
  assert.equal(hydrated.ok, false);
});
