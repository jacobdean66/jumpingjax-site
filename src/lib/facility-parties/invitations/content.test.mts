import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerInvitationEmailSection,
  buildInvitationCopy,
  buildInvitationEmailDraft,
} from "./content.ts";

const sonic = {
  childName: " Miles  ",
  childAge: "6",
  dateLabel: "Saturday, August 22, 2026",
  timeLabel: "2:00 PM - 3:30 PM",
  themeText: "Sonic party theme",
  invitationUrl: "https://jumpingjaxllc.com/invite/123",
  printableUrl: "https://jumpingjaxllc.com/invite/123/sheet",
  waiverUrl: "https://jumpingjaxllc.com/waiver/123",
};

test("invitation copy removes redundant party wording and preserves exact event details", () => {
  const copy = buildInvitationCopy(sonic);

  assert.equal(copy.headline, "Miles is turning 6!");
  assert.equal(copy.celebrationLine, "A Sonic birthday celebration");
  assert.equal(copy.dateLabel, sonic.dateLabel);
  assert.equal(copy.timeLabel, sonic.timeLabel);
  assert.equal(
    copy.venueLine,
    "Jumping Jax - 559 Beaudrot Rd, Greenwood, SC",
  );
});

test("guest email draft contains the same date, time, location, and all delivery links", () => {
  const draft = buildInvitationEmailDraft(sonic);

  assert.equal(draft.subject, "You're invited: Miles's 6th birthday at Jumping Jax");
  for (const expected of [
    sonic.dateLabel,
    sonic.timeLabel,
    "Jumping Jax - 559 Beaudrot Rd, Greenwood, SC",
    sonic.invitationUrl,
    sonic.printableUrl,
    sonic.waiverUrl,
  ]) {
    assert.match(draft.body, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("customer booking emails receive one canonical invitation package", () => {
  const section = buildCustomerInvitationEmailSection(sonic).join("\n");

  assert.match(section, /Your invitation package/);
  assert.match(section, /Guest of honor: Miles \(6th birthday\)/);
  assert.match(section, /Theme: Sonic party theme/);
  assert.match(section, /Printable invitations:/);
  assert.match(section, /Guest RSVP and waiver:/);
});

test("ordinal ages are grammatically correct", () => {
  assert.equal(buildInvitationEmailDraft({ ...sonic, childAge: "1" }).subject, "You're invited: Miles's 1st birthday at Jumping Jax");
  assert.equal(buildInvitationEmailDraft({ ...sonic, childAge: "2" }).subject, "You're invited: Miles's 2nd birthday at Jumping Jax");
  assert.equal(buildInvitationEmailDraft({ ...sonic, childAge: "3" }).subject, "You're invited: Miles's 3rd birthday at Jumping Jax");
  assert.equal(buildInvitationEmailDraft({ ...sonic, childAge: "11" }).subject, "You're invited: Miles's 11th birthday at Jumping Jax");
});
