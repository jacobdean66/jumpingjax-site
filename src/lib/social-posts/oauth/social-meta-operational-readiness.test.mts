import assert from "node:assert/strict";
import test from "node:test";
import { describeMetaOperationalReadiness } from "./social-meta-operational-readiness";

const session = { session_id: "publish-new", publication_target_id: "page-target", provider: "meta", lifecycle_state: "connected" };
const binding = { publication_target_id: "page-target", oauth_session_id: "publish-new", asset_kind: "facebook_page", binding_state: "active" };
const setup = { configured: true, postsReadable: true, sessions: [session], bindings: [binding], schedulerReadable: true, enabledFacebookTargetIds: ["page-target"] };

test("analytics-only and awaiting-callback sessions never prove Facebook publishing readiness", () => {
  const state = describeMetaOperationalReadiness({ ...setup, sessions: [
    { ...session, publication_target_id: "ad-analytics" },
    { ...session, lifecycle_state: "awaiting_callback" },
  ] });
  assert.equal(state.social.state, "setup_required");
  assert.match(state.social.blocker!, /analytics session does not connect publishing/);
  assert.equal(state.analytics.state, "degraded");
  assert.match(state.analytics.summary, /were not checked/);
});

test("publication sessions cannot stand in for analytics reporting acceptance", () => {
  const state = describeMetaOperationalReadiness(setup);
  assert.equal(state.analytics.state, "setup_required");
  assert.equal(state.analyticsSessionCount, 0);
  assert.equal(state.social.state, "degraded");
  assert.match(state.social.summary, /acceptance were not checked/);
});

test("an older connected session binding does not validate the current session", () => {
  const state = describeMetaOperationalReadiness({ ...setup, sessions: [session, { ...session, session_id: "publish-old" }], bindings: [{ ...binding, oauth_session_id: "publish-old" }] });
  assert.equal(state.social.state, "setup_required");
  assert.match(state.social.blocker!, /bind the Facebook Page/);
});

test("disabled targets, missing schema, and unreadable storage remain explicit blockers", () => {
  const state = describeMetaOperationalReadiness({ ...setup, schedulerReadable: false, enabledFacebookTargetIds: [] });
  assert.equal(state.social.state, "setup_required");
  assert.match(state.social.blocker!, /Enable a Facebook/);
  assert.match(state.social.blocker!, /20260925130000/);
  const unreadable = describeMetaOperationalReadiness({ ...setup, sessions: null });
  assert.equal(unreadable.social.state, "unavailable");
  assert.equal(unreadable.analytics.state, "unavailable");
});
