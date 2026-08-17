import "server-only";

import { Resend } from "resend";

import { importedGiveawayNominations } from "./imported";
import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase/admin";

export type GiveawayNomination = Readonly<{
  id: string;
  nominatorName: string;
  nominatorEmail: string;
  childName: string;
  birthday: string;
  partyChoice: string;
  whyNominated: string;
  source: string;
  status: string;
  createdAt: string;
}>;

const OWNER_SUBJECT_PREFIX = "Free Party Nomination:";
const LEGACY_OWNER_SUBJECT = "New Jumping Jax giveaway nomination";
const MAX_PAGES = 10;
type GiveawayNominationRow = Readonly<{
  id: string;
  nominator_name: string;
  nominator_email: string;
  child_name: string;
  birthday: string;
  party_choice: string;
  why_nominated: string;
  source: string;
  status: string;
  created_at: string;
}>;

function fromRow(row: GiveawayNominationRow): GiveawayNomination {
  return {
    id: row.id,
    nominatorName: row.nominator_name,
    nominatorEmail: row.nominator_email,
    childName: row.child_name,
    birthday: row.birthday,
    partyChoice: row.party_choice,
    whyNominated: row.why_nominated,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
  };
}


function field(text: string, label: string): string {
  const match = text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function parseNomination(text: string, createdAt: string): GiveawayNomination | null {
  if (/SYNTHETIC LAUNCH TEST ONLY/i.test(text)) return null;

  const whyMatch = text.match(
    /Why this child was nominated:\s*([\s\S]*?)(?:\r?\n\r?\nSubmitted:|\r?\nNomination ID:|$)/i,
  );
  const id = field(text, "Nomination ID");
  const nominatorName = field(text, "Nominator");
  const nominatorEmail = field(text, "Nominator email");
  const childName = field(text, "Child");
  const birthday = field(text, "Birthday");
  const partyChoice = field(text, "Party choice");
  const whyNominated = whyMatch?.[1]?.trim() ?? "";

  if (
    !id ||
    !nominatorName ||
    !nominatorEmail ||
    !childName ||
    !birthday ||
    !partyChoice ||
    !whyNominated
  ) {
    return null;
  }

  return {
    id,
    nominatorName,
    nominatorEmail,
    childName,
    birthday,
    partyChoice,
    whyNominated,
    source: "Nomination form",
    status: "new",
    createdAt,
  };
}

export async function loadGiveawayNominations(): Promise<{
  nominations: readonly GiveawayNomination[];
  error: string | null;
}> {
  const unique = new Map<string, GiveawayNomination>(
    importedGiveawayNominations.map((nomination) => [nomination.id, nomination]),
  );

  if (isSupabaseServiceConfigured()) {
    const { data, error } = await createServiceRoleClient()
      .from("giveaway_nominations")
      .select(
        "id,nominator_name,nominator_email,child_name,birthday,party_choice,why_nominated,source,status,created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load stored giveaway nominations:", error.message);
    } else {
      for (const row of (data ?? []) as GiveawayNominationRow[]) {
        unique.set(row.id, fromRow(row));
      }
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      nominations: [...unique.values()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      error: null,
    };
  }

  const resend = new Resend(apiKey);
  const candidates: Array<{ id: string; createdAt: string }> = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await resend.emails.list({ limit: 100, after });
    if (error || !data) {
      break;
    }

    for (const email of data.data) {
      if (
        email.subject.startsWith(OWNER_SUBJECT_PREFIX) ||
        email.subject === LEGACY_OWNER_SUBJECT
      ) {
        candidates.push({ id: email.id, createdAt: email.created_at });
      }
    }

    const lastEmail = data.data.at(-1);
    if (!data.has_more || !lastEmail) break;
    after = lastEmail.id;
  }

  const retrieved = await Promise.all(
    candidates.map(async (candidate) => {
      const { data, error } = await resend.emails.get(candidate.id);
      if (error || !data?.text) return null;
      return parseNomination(data.text, data.created_at || candidate.createdAt);
    }),
  );

  for (const nomination of retrieved) {
    if (nomination) unique.set(nomination.id, nomination);
  }

  return {
    nominations: [...unique.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    error: null,
  };
}
