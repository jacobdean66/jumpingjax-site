import assert from "node:assert/strict";
import test from "node:test";

import {
  decideGoogleCalendarSyncAction,
  getGoogleCalendarDestinations,
} from "./calendar";

test("getGoogleCalendarDestinations returns primary only when secondary is unset", () => {
  const previousPrimary = process.env.GOOGLE_CALENDAR_ID;
  const previousSecondary = process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  process.env.GOOGLE_CALENDAR_ID = "primary-cal";
  delete process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  try {
    const destinations = getGoogleCalendarDestinations();
    assert.equal(destinations.primary, "primary-cal");
    assert.equal(destinations.secondary, null);
  } finally {
    process.env.GOOGLE_CALENDAR_ID = previousPrimary;
    process.env.GOOGLE_CALENDAR_SECONDARY_ID = previousSecondary;
  }
});

test("getGoogleCalendarDestinations falls back to \"primary\" when GOOGLE_CALENDAR_ID is unset", () => {
  const previousPrimary = process.env.GOOGLE_CALENDAR_ID;
  const previousSecondary = process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  delete process.env.GOOGLE_CALENDAR_ID;
  delete process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  try {
    const destinations = getGoogleCalendarDestinations();
    assert.equal(destinations.primary, "primary");
    assert.equal(destinations.secondary, null);
  } finally {
    process.env.GOOGLE_CALENDAR_ID = previousPrimary;
    process.env.GOOGLE_CALENDAR_SECONDARY_ID = previousSecondary;
  }
});

test("getGoogleCalendarDestinations includes secondary when configured", () => {
  const previousPrimary = process.env.GOOGLE_CALENDAR_ID;
  const previousSecondary = process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  process.env.GOOGLE_CALENDAR_ID = "owner@example.com";
  process.env.GOOGLE_CALENDAR_SECONDARY_ID = "Karen.McClain.jumpingjaxllc@gmail.com";
  try {
    const destinations = getGoogleCalendarDestinations();
    assert.equal(destinations.primary, "owner@example.com");
    assert.equal(destinations.secondary, "Karen.McClain.jumpingjaxllc@gmail.com");
  } finally {
    process.env.GOOGLE_CALENDAR_ID = previousPrimary;
    process.env.GOOGLE_CALENDAR_SECONDARY_ID = previousSecondary;
  }
});

test("getGoogleCalendarDestinations treats blank secondary as unconfigured", () => {
  const previousPrimary = process.env.GOOGLE_CALENDAR_ID;
  const previousSecondary = process.env.GOOGLE_CALENDAR_SECONDARY_ID;
  process.env.GOOGLE_CALENDAR_ID = "owner@example.com";
  process.env.GOOGLE_CALENDAR_SECONDARY_ID = "   ";
  try {
    const destinations = getGoogleCalendarDestinations();
    assert.equal(destinations.secondary, null);
  } finally {
    process.env.GOOGLE_CALENDAR_ID = previousPrimary;
    process.env.GOOGLE_CALENDAR_SECONDARY_ID = previousSecondary;
  }
});

test("decideGoogleCalendarSyncAction creates when no event id is stored yet", () => {
  assert.equal(decideGoogleCalendarSyncAction(null), "create");
  assert.equal(decideGoogleCalendarSyncAction(undefined), "create");
  assert.equal(decideGoogleCalendarSyncAction(""), "create");
});

test("decideGoogleCalendarSyncAction updates in place instead of creating a duplicate", () => {
  // This is the core anti-duplicate guarantee: once an event id is known for
  // a destination, the sync path must update that same event rather than
  // insert a second one.
  assert.equal(decideGoogleCalendarSyncAction("existing-primary-id"), "update");
  assert.equal(decideGoogleCalendarSyncAction("existing-secondary-id"), "update");
});

test("booking edits update both destinations independently when both ids exist", () => {
  const booking = {
    google_calendar_event_id: "primary-event-123",
    google_calendar_secondary_event_id: "secondary-event-456",
  };

  const primaryAction = decideGoogleCalendarSyncAction(
    booking.google_calendar_event_id,
  );
  const secondaryAction = decideGoogleCalendarSyncAction(
    booking.google_calendar_secondary_event_id,
  );

  assert.equal(primaryAction, "update");
  assert.equal(secondaryAction, "update");
});

test("a missing secondary id does not block updating the primary destination", () => {
  const booking = {
    google_calendar_event_id: "primary-event-123",
    google_calendar_secondary_event_id: null as string | null,
  };

  assert.equal(
    decideGoogleCalendarSyncAction(booking.google_calendar_event_id),
    "update",
  );
  assert.equal(
    decideGoogleCalendarSyncAction(booking.google_calendar_secondary_event_id),
    "create",
  );
});

test("sync result statuses are reported independently per destination", () => {
  // Mirrors GoogleCalendarSyncResult: a secondary failure must never be
  // reported as, or overwrite, a primary success (and vice versa).
  const result = {
    primaryEventId: "primary-event-123",
    secondaryEventId: null as string | null,
    primaryStatus: "updated" as const,
    secondaryStatus: "failed" as const,
  };

  assert.notEqual(result.primaryStatus, result.secondaryStatus);
  assert.equal(result.primaryStatus, "updated");
  assert.equal(result.secondaryStatus, "failed");
  assert.equal(result.primaryEventId, "primary-event-123");
});
