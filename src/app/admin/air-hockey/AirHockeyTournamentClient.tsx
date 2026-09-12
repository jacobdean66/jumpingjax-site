"use client";

import { useMemo, useState } from "react";
import type { AirHockeyBracket } from "@/lib/admin/air-hockey-bracket";
import type { AirHockeyPlayer } from "@/lib/admin/air-hockey-tournament-admin";

type TournamentState = {
  players: AirHockeyPlayer[];
  bracket: AirHockeyBracket;
  activePlayerCount: number;
};

type ActionState = "idle" | "saving" | "saved" | "error";

function isTournamentState(value: unknown): value is TournamentState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TournamentState>;
  return (
    Array.isArray(candidate.players) &&
    typeof candidate.activePlayerCount === "number" &&
    Boolean(candidate.bracket)
  );
}

function fieldValue(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function playerLabel(players: readonly AirHockeyPlayer[], playerId: string | null) {
  if (!playerId) return "TBD";
  return players.find((player) => player.id === playerId)?.displayName ?? "Player";
}

export function AirHockeyTournamentClient({
  initialState,
}: {
  initialState: TournamentState;
}) {
  const [state, setState] = useState<TournamentState>(initialState);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");

  const activePlayers = useMemo(
    () => state.players.filter((player) => player.isActive),
    [state.players],
  );
  const firstRoundSlots = useMemo(
    () =>
      state.bracket.rounds[0]?.flatMap((match) => [match.slot1, match.slot2]) ??
      [],
    [state.bracket],
  );
  const championName = playerLabel(state.players, state.bracket.championId);

  async function runAction(payload: Record<string, unknown>) {
    setActionState("saving");
    setMessage("");
    const response = await fetch("/api/admin/air-hockey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const next = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok || !isTournamentState(next)) {
      setActionState("error");
      const error =
        next && typeof next === "object" && "error" in next
          ? String((next as { error?: unknown }).error ?? "")
          : "";
      setMessage(error || "Update failed.");
      return;
    }
    setState(next);
    setActionState("saved");
  }

  async function addPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction({
      action: "add-player",
      displayName: fieldValue(form, "displayName"),
      guardianName: fieldValue(form, "guardianName"),
      email: fieldValue(form, "email"),
      phone: fieldValue(form, "phone"),
      notes: fieldValue(form, "notes"),
    });
    if (actionState !== "error") event.currentTarget.reset();
  }

  async function renamePlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction({
      action: "rename-player",
      playerId: fieldValue(form, "playerId"),
      displayName: fieldValue(form, "displayName"),
    });
  }

  async function saveAssignments(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction({
      action: "save-assignments",
      assignments: firstRoundSlots.map((_, index) =>
        fieldValue(form, `slot-${index}`),
      ),
    });
  }

  const buttonClass =
    "inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:bg-slate-400";
  const inputClass =
    "mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold text-slate-950 outline-none focus:border-sky-500";

  return (
    <div className="mt-8 grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Active players
          </p>
          <p className="mt-2 text-4xl font-black text-slate-950">
            {state.activePlayerCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Bracket rounds
          </p>
          <p className="mt-2 text-4xl font-black text-slate-950">
            {state.bracket.rounds.length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Champion
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-950">
            {state.bracket.championId ? championName : "Not decided"}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          className={buttonClass}
          disabled={actionState === "saving"}
          onClick={() => runAction({ action: "import" })}
        >
          Import registrations
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={actionState === "saving"}
          onClick={() => runAction({ action: "rebuild-bracket" })}
        >
          Build bracket
        </button>
        {actionState === "saving" ? (
          <span className="text-sm font-black text-slate-600">Saving...</span>
        ) : null}
        {actionState === "saved" ? (
          <span className="text-sm font-black text-emerald-700">Saved</span>
        ) : null}
        {actionState === "error" ? (
          <span className="text-sm font-black text-rose-700">{message}</span>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-slate-950">Players</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 py-2 pr-4">Player</th>
                  <th className="border-b border-slate-200 py-2 pr-4">Guardian</th>
                  <th className="border-b border-slate-200 py-2 pr-4">Contact</th>
                  <th className="border-b border-slate-200 py-2 pr-4">Source</th>
                  <th className="border-b border-slate-200 py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((player) => (
                  <tr key={player.id} className="align-top">
                    <td className="border-b border-slate-100 py-3 pr-4">
                      <p className="font-black">{player.displayName}</p>
                      {player.originalName &&
                      player.originalName !== player.displayName ? (
                        <p className="text-xs font-semibold text-slate-500">
                          From signup: {player.originalName}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4 font-semibold">
                      {player.guardianName ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4">
                      <p>{player.email ?? "-"}</p>
                      <p className="text-slate-500">{player.phone ?? "-"}</p>
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4">
                      {player.sourceSignupId ? "Online" : "Walk-in"}
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4">
                      {player.notes ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6">
          <form
            onSubmit={addPlayer}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-2xl font-black text-slate-950">Add walk-in</h2>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-bold text-slate-700">
                Player name
                <input required name="displayName" className={inputClass} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Guardian
                <input name="guardianName" className={inputClass} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Email
                <input type="email" name="email" className={inputClass} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Phone
                <input name="phone" className={inputClass} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Notes
                <textarea name="notes" rows={2} className={inputClass} />
              </label>
              <button
                type="submit"
                className={buttonClass}
                disabled={actionState === "saving"}
              >
                Add player
              </button>
            </div>
          </form>

          <form
            onSubmit={renamePlayer}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-2xl font-black text-slate-950">Correct name</h2>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-bold text-slate-700">
                Player
                <select required name="playerId" className={inputClass}>
                  <option value="">Choose player</option>
                  {state.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                Corrected name
                <input required name="displayName" className={inputClass} />
              </label>
              <button
                type="submit"
                className={buttonClass}
                disabled={actionState === "saving"}
              >
                Save name
              </button>
            </div>
          </form>
        </div>
      </section>

      {firstRoundSlots.length > 0 ? (
        <form
          onSubmit={saveAssignments}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-2xl font-black text-slate-950">
            First-round assignments
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {firstRoundSlots.map((slot, index) => (
              <label
                key={`${slot.playerId ?? "bye"}-${index}`}
                className="text-sm font-bold text-slate-700"
              >
                Slot {index + 1}
                <select
                  name={`slot-${index}`}
                  defaultValue={slot.playerId ?? ""}
                  className={inputClass}
                >
                  <option value="">Bye</option>
                  {activePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className={`${buttonClass} mt-4`}
            disabled={actionState === "saving"}
          >
            Save assignments
          </button>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">Bracket</h2>
        {state.bracket.rounds.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Build the bracket once the player list is ready.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-flow-col xl:auto-cols-fr">
            {state.bracket.rounds.map((round, roundIndex) => (
              <div key={roundIndex} className="grid content-start gap-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                  {roundIndex === state.bracket.rounds.length - 1
                    ? "Final"
                    : `Round ${roundIndex + 1}`}
                </h3>
                {round.map((match) => {
                  const options = [match.slot1, match.slot2].filter(
                    (slot) => slot.playerId && !slot.isBye,
                  );
                  return (
                    <div
                      key={match.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="grid gap-2 text-sm font-bold">
                        {[match.slot1, match.slot2].map((slot, index) => (
                          <div
                            key={`${match.id}-${index}`}
                            className={
                              slot.playerId === match.winnerId
                                ? "rounded-lg bg-emerald-100 px-3 py-2 text-emerald-950"
                                : "rounded-lg bg-white px-3 py-2 text-slate-800"
                            }
                          >
                            {slot.name}
                          </div>
                        ))}
                      </div>
                      {options.length > 1 ? (
                        <div className="mt-3 grid gap-2">
                          <select
                            aria-label={`Winner for ${match.id}`}
                            value={match.winnerId ?? ""}
                            onChange={(event) => {
                              if (event.target.value) {
                                runAction({
                                  action: "select-winner",
                                  matchId: match.id,
                                  winnerId: event.target.value,
                                });
                              }
                            }}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                          >
                            <option value="">Select winner</option>
                            {options.map((slot) => (
                              <option key={slot.playerId} value={slot.playerId ?? ""}>
                                {slot.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
