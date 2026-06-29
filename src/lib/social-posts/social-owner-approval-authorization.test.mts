import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOwnerApprovalAuthoritySnapshot,
  evaluateOwnerApprovalAuthorization,
  type OwnerApprovalActor,
  type OwnerApprovalAuthorizationScope,
} from "./social-owner-approval-authorization";
import * as authorizationExports from "./social-owner-approval-authorization";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalScope,
  SocialOwnerApprovalSocialPostId,
} from "./social-owner-approval-persistence";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function proposalScope(
  input: Partial<SocialOwnerApprovalProposalScope> = {},
): SocialOwnerApprovalProposalScope {
  return {
    socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
    proposalFingerprint:
      "fingerprint-1" as SocialOwnerApprovalProposalScope["proposalFingerprint"],
    proposalVersion:
      "v1" as SocialOwnerApprovalProposalScope["proposalVersion"],
    campaignId: "campaign-1",
    platforms: ["facebook", "instagram"],
    ...input,
  };
}

function context(
  input: Partial<OwnerApprovalAuthorizationScope> = {},
): OwnerApprovalAuthorizationScope {
  return {
    proposalId: "proposal-1" as SocialOwnerApprovalProposalId,
    approvalId: "approval-1" as SocialOwnerApprovalApprovalId,
    socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
    campaignId: "campaign-1",
    manifestId: "manifest-1",
    proposalScope: proposalScope(),
    requiresOwnerAuthority: true,
    ...input,
  };
}

function actor(input: Partial<OwnerApprovalActor> = {}): OwnerApprovalActor {
  return {
    actorId: "owner-1",
    actorType: "human",
    authoritySnapshot: createOwnerApprovalAuthoritySnapshot({
      actorId: "owner-1",
      actorType: "human",
      authorityRole: "owner",
      canApprove: true,
      authoritySource: "admin_session",
    }),
    authorityScope: {
      socialPostId: "post-1" as SocialOwnerApprovalSocialPostId,
      campaignId: "campaign-1",
      manifestId: "manifest-1",
    },
    displayName: "Owner",
    ...input,
  };
}

await test("owner actor can be allowed for owner-only action", () => {
  const result = evaluateOwnerApprovalAuthorization({
    actor: actor(),
    action: "approve_owner_approval",
    context: context(),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.code, "authorized");
  assert.equal(result.evidence.authorityRole, "owner");
});

await test("non-owner actor is denied for approve, reject, and revoke", () => {
  for (const action of [
    "approve_owner_approval",
    "reject_owner_approval",
    "revoke_owner_approval",
  ]) {
    const result = evaluateOwnerApprovalAuthorization({
      actor: actor({
        authoritySnapshot: createOwnerApprovalAuthoritySnapshot({
          actorId: "owner-1",
          actorType: "human",
          authorityRole: "admin",
          canApprove: true,
          authoritySource: "admin_session",
        }),
      }),
      action,
      context: context(),
    });

    assert.equal(result.allowed, false);
    assert.equal(result.code, "owner_authority_required");
  }
});

await test("missing actor authority snapshot is denied", () => {
  const result = evaluateOwnerApprovalAuthorization({
    actor: actor({ authoritySnapshot: null }),
    action: "request_owner_approval",
    context: context(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "actor_authority_missing");
});

await test("mismatched campaign, post, and manifest scope is denied", () => {
  const mismatches = [
    context({
      campaignId: "campaign-2",
    }),
    context({
      socialPostId: "post-2" as SocialOwnerApprovalSocialPostId,
    }),
    context({
      manifestId: "manifest-2",
    }),
  ];

  for (const scopedContext of mismatches) {
    const result = evaluateOwnerApprovalAuthorization({
      actor: actor(),
      action: "view_owner_approval",
      context: scopedContext,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.code, "scope_mismatch");
  }
});

await test("unknown action is denied", () => {
  const result = evaluateOwnerApprovalAuthorization({
    actor: actor(),
    action: "publishApproved",
    context: context(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "unknown_action");
});

await test("view action can be allowed only when actor scope matches", () => {
  const allowed = evaluateOwnerApprovalAuthorization({
    actor: actor(),
    action: "view_owner_approval",
    context: context({ requiresOwnerAuthority: false }),
  });
  const denied = evaluateOwnerApprovalAuthorization({
    actor: actor({
      actorId: "owner-2",
    }),
    action: "view_owner_approval",
    context: context({ requiresOwnerAuthority: false }),
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.code, "authorized");
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "scope_mismatch");
});

await test("result includes deterministic reason and evidence", () => {
  const first = evaluateOwnerApprovalAuthorization({
    actor: actor(),
    action: "request_owner_approval",
    context: context(),
  });
  const second = evaluateOwnerApprovalAuthorization({
    actor: actor(),
    action: "request_owner_approval",
    context: context(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.reason, "Actor is authorized for this owner approval action and scope.");
  assert.equal(first.evidence.action, "request_owner_approval");
});

await test("authorization exports no current approval or lifecycle replay helpers", () => {
  const forbidden = [
    "currentApproval",
    "getCurrentApproval",
    "computeCurrentApproval",
    "replayApprovalLifecycle",
    "evaluateApprovalValidity",
    "isApprovalValid",
  ];

  for (const name of forbidden) {
    assert.equal(name in authorizationExports, false);
  }
});

await test("authorization module performs no repository writes", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-authorization.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("createOwnerApprovalProposal"), false);
  assert.equal(source.includes("appendOwnerApprovalEvent"), false);
  assert.equal(source.includes("social-owner-approval-store"), false);
});

await test("authorization module has no Supabase, API, route, or UI imports", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "social-owner-approval-authorization.ts",
    ),
    "utf8",
  );

  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("next/"), false);
  assert.equal(source.includes(".tsx"), false);
});
