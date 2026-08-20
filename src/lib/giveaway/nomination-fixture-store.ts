import type { GiveawayNominationRow } from "./nomination-email";

export type StoredFixtureNomination = GiveawayNominationRow & {
  id: string;
  created_at: string;
  confirmation_email_sent: false;
  owner_email_sent: false;
};

export type NominationFixtureState = Map<string, StoredFixtureNomination>;

export function saveFixtureNomination(state: NominationFixtureState, row: GiveawayNominationRow) {
  const existing = state.get(row.idempotency_key);
  if (existing) return { id: existing.id, created: false };
  const stored: StoredFixtureNomination = {
    ...row,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    confirmation_email_sent: false,
    owner_email_sent: false,
  };
  state.set(row.idempotency_key, stored);
  return { id: stored.id, created: true };
}

export function listFixtureState(state: NominationFixtureState) {
  return [...state.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

