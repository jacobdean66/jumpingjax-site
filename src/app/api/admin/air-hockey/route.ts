import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  addAirHockeyWalkInPlayer,
  importAirHockeyRegistrations,
  loadAirHockeyTournamentState,
  rebuildAirHockeyBracket,
  renameAirHockeyPlayer,
  saveAirHockeyFirstRoundAssignments,
  selectAirHockeyMatchWinner,
} from "@/lib/admin/air-hockey-tournament-admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner login required." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const authError = await requireOwner();
  if (authError) return authError;

  try {
    return NextResponse.json(await loadAirHockeyTournamentState(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[air-hockey] load failed", error);
    return NextResponse.json(
      { error: "Tournament state could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    scope: "admin-air-hockey",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const authError = await requireOwner();
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "import":
        await importAirHockeyRegistrations();
        break;
      case "add-player":
        await addAirHockeyWalkInPlayer({
          displayName: String(body.displayName ?? ""),
          guardianName: typeof body.guardianName === "string" ? body.guardianName : null,
          email: typeof body.email === "string" ? body.email : null,
          phone: typeof body.phone === "string" ? body.phone : null,
          notes: typeof body.notes === "string" ? body.notes : null,
        });
        break;
      case "rename-player":
        await renameAirHockeyPlayer(
          String(body.playerId ?? ""),
          String(body.displayName ?? ""),
        );
        break;
      case "rebuild-bracket":
        await rebuildAirHockeyBracket();
        break;
      case "save-assignments":
        await saveAirHockeyFirstRoundAssignments(
          Array.isArray(body.assignments)
            ? body.assignments.map((item) =>
                typeof item === "string" && item ? item : null,
              )
            : [],
        );
        break;
      case "select-winner":
        await selectAirHockeyMatchWinner(
          String(body.matchId ?? ""),
          String(body.winnerId ?? ""),
        );
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json(await loadAirHockeyTournamentState(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[air-hockey] action failed", error);
    const message =
      error instanceof Error ? error.message : "Tournament update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
