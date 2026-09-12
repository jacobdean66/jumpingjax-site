import { createServiceRoleClient } from "@/lib/supabase/admin";
import { AIR_HOCKEY_EVENT_ID } from "./air-hockey-campaign";
import {
  buildAirHockeyBracket,
  emptyAirHockeyBracket,
  setAirHockeyMatchWinner,
  updateFirstRoundAssignments,
  type AirHockeyBracket,
  type AirHockeyBracketPlayer,
} from "./air-hockey-bracket";

export type AirHockeyPlayer = {
  id: string;
  displayName: string;
  originalName: string | null;
  guardianName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  sourceSignupId: string | null;
  sourcePlayerIndex: number | null;
  isActive: boolean;
  nameManuallyCorrected: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlayerRow = {
  id: string;
  display_name: string;
  original_name: string | null;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source_signup_id: string | null;
  source_player_index: number | null;
  is_active: boolean;
  name_manually_corrected: boolean;
  created_at: string;
  updated_at: string;
};

type SignupRow = {
  id: string;
  parent_name: string;
  child_name: string | null;
  email: string | null;
  phone: string | null;
  player_count: number | null;
  notes: string | null;
  created_at: string;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function playerNameForSignup(signup: SignupRow, index: number): string {
  const baseName = cleanText(signup.child_name) ?? cleanText(signup.parent_name) ?? "Player";
  const count = Math.max(1, Math.trunc(Number(signup.player_count) || 1));
  return count > 1 ? `${baseName} ${index}` : baseName;
}

function mapPlayer(row: PlayerRow): AirHockeyPlayer {
  return {
    id: row.id,
    displayName: row.display_name,
    originalName: row.original_name,
    guardianName: row.guardian_name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    sourceSignupId: row.source_signup_id,
    sourcePlayerIndex: row.source_player_index,
    isActive: row.is_active,
    nameManuallyCorrected: row.name_manually_corrected,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBracketPlayers(players: readonly AirHockeyPlayer[]): AirHockeyBracketPlayer[] {
  return players
    .filter((player) => player.isActive)
    .map((player) => ({ id: player.id, name: player.displayName }));
}

function parseBracket(value: unknown): AirHockeyBracket {
  if (!value || typeof value !== "object") return emptyAirHockeyBracket();
  const bracket = value as Partial<AirHockeyBracket>;
  if (bracket.version !== 1 || !Array.isArray(bracket.rounds)) {
    return emptyAirHockeyBracket();
  }
  return bracket as AirHockeyBracket;
}

export async function importAirHockeyRegistrations() {
  const supabase = createServiceRoleClient();
  const { data: signups, error: signupError } = await supabase
    .from("campaign_event_signups")
    .select("id, parent_name, child_name, email, phone, player_count, notes, created_at")
    .eq("event_id", AIR_HOCKEY_EVENT_ID)
    .order("created_at", { ascending: true });
  if (signupError) throw signupError;

  for (const signup of (signups ?? []) as SignupRow[]) {
    const count = Math.max(1, Math.trunc(Number(signup.player_count) || 1));
    const { data: existingRows, error: existingError } = await supabase
      .from("air_hockey_players")
      .select("id, source_player_index, name_manually_corrected")
      .eq("source_signup_id", signup.id);
    if (existingError) throw existingError;

    const existing = new Map(
      ((existingRows ?? []) as Pick<
        PlayerRow,
        "id" | "source_player_index" | "name_manually_corrected"
      >[]).map((row) => [row.source_player_index, row]),
    );

    for (let index = 1; index <= count; index += 1) {
      const existingPlayer = existing.get(index);
      const nextName = playerNameForSignup(signup, index);
      if (existingPlayer) {
        const update: Record<string, unknown> = {
          original_name: nextName,
          guardian_name: cleanText(signup.parent_name),
          email: cleanText(signup.email),
          phone: cleanText(signup.phone),
          notes: cleanText(signup.notes),
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        if (!existingPlayer.name_manually_corrected) update.display_name = nextName;
        const { error } = await supabase
          .from("air_hockey_players")
          .update(update)
          .eq("id", existingPlayer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("air_hockey_players").insert({
          source_signup_id: signup.id,
          source_player_index: index,
          display_name: nextName,
          original_name: nextName,
          guardian_name: cleanText(signup.parent_name),
          email: cleanText(signup.email),
          phone: cleanText(signup.phone),
          notes: cleanText(signup.notes),
          is_active: true,
        });
        if (error) throw error;
      }
    }

    const extraIds = [...existing.values()]
      .filter((row) => Number(row.source_player_index) > count)
      .map((row) => row.id);
    if (extraIds.length > 0) {
      const { error } = await supabase
        .from("air_hockey_players")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", extraIds);
      if (error) throw error;
    }
  }
}

export async function listAirHockeyPlayers(): Promise<AirHockeyPlayer[]> {
  await importAirHockeyRegistrations();
  const { data, error } = await createServiceRoleClient()
    .from("air_hockey_players")
    .select("id, display_name, original_name, guardian_name, email, phone, notes, source_signup_id, source_player_index, is_active, name_manually_corrected, created_at, updated_at")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PlayerRow[]).map(mapPlayer);
}

export async function loadAirHockeyBracket(): Promise<AirHockeyBracket> {
  const { data, error } = await createServiceRoleClient()
    .from("air_hockey_brackets")
    .select("bracket")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  return parseBracket((data as { bracket?: unknown } | null)?.bracket);
}

export async function saveAirHockeyBracket(bracket: AirHockeyBracket) {
  const { error } = await createServiceRoleClient()
    .from("air_hockey_brackets")
    .upsert({
      id: "main",
      bracket,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return bracket;
}

export async function loadAirHockeyTournamentState() {
  const [players, bracket] = await Promise.all([
    listAirHockeyPlayers(),
    loadAirHockeyBracket(),
  ]);
  return {
    players,
    bracket,
    activePlayerCount: players.filter((player) => player.isActive).length,
  };
}

export async function addAirHockeyWalkInPlayer(input: {
  displayName: string;
  guardianName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  const name = cleanText(input.displayName);
  if (!name) throw new Error("Player name is required.");
  const { error } = await createServiceRoleClient().from("air_hockey_players").insert({
    display_name: name,
    original_name: name,
    guardian_name: cleanText(input.guardianName),
    email: cleanText(input.email),
    phone: cleanText(input.phone),
    notes: cleanText(input.notes),
    is_active: true,
    name_manually_corrected: true,
  });
  if (error) throw error;
}

export async function renameAirHockeyPlayer(playerId: string, displayName: string) {
  const name = cleanText(displayName);
  if (!playerId || !name) throw new Error("Player and name are required.");
  const { error } = await createServiceRoleClient()
    .from("air_hockey_players")
    .update({
      display_name: name,
      name_manually_corrected: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId);
  if (error) throw error;
}

export async function rebuildAirHockeyBracket() {
  const players = await listAirHockeyPlayers();
  return saveAirHockeyBracket(buildAirHockeyBracket(toBracketPlayers(players)));
}

export async function saveAirHockeyFirstRoundAssignments(
  assignments: readonly (string | null)[],
) {
  const [players, bracket] = await Promise.all([
    listAirHockeyPlayers(),
    loadAirHockeyBracket(),
  ]);
  return saveAirHockeyBracket(
    updateFirstRoundAssignments(bracket, assignments, toBracketPlayers(players)),
  );
}

export async function selectAirHockeyMatchWinner(
  matchId: string,
  winnerId: string,
) {
  const bracket = await loadAirHockeyBracket();
  return saveAirHockeyBracket(setAirHockeyMatchWinner(bracket, matchId, winnerId));
}
