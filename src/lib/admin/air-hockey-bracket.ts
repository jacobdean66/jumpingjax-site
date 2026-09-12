export type AirHockeyBracketPlayer = {
  id: string;
  name: string;
};

export type AirHockeyBracketSlot = {
  playerId: string | null;
  name: string;
  isBye?: boolean;
};

export type AirHockeyBracketMatch = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  slot1: AirHockeyBracketSlot;
  slot2: AirHockeyBracketSlot;
  winnerId: string | null;
};

export type AirHockeyBracket = {
  version: 1;
  generatedAt: string;
  rounds: AirHockeyBracketMatch[][];
  championId: string | null;
};

export function emptyAirHockeyBracket(): AirHockeyBracket {
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    rounds: [],
    championId: null,
  };
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return Math.max(2, size);
}

function makeMatch(
  roundIndex: number,
  matchIndex: number,
  slot1?: AirHockeyBracketSlot,
  slot2?: AirHockeyBracketSlot,
): AirHockeyBracketMatch {
  return {
    id: `r${roundIndex + 1}m${matchIndex + 1}`,
    roundIndex,
    matchIndex,
    slot1: slot1 ?? { playerId: null, name: "TBD" },
    slot2: slot2 ?? { playerId: null, name: "TBD" },
    winnerId: null,
  };
}

function normalizeSlot(
  player?: AirHockeyBracketPlayer,
): AirHockeyBracketSlot {
  if (!player) return { playerId: null, name: "Bye", isBye: true };
  return { playerId: player.id, name: player.name };
}

function findPlayerName(
  players: readonly AirHockeyBracketPlayer[],
  playerId: string,
): string {
  return players.find((player) => player.id === playerId)?.name ?? "Winner";
}

export function buildAirHockeyBracket(
  players: readonly AirHockeyBracketPlayer[],
  now = new Date(),
): AirHockeyBracket {
  const activePlayers = players.filter((player) => player.id && player.name);
  const bracketSize = nextPowerOfTwo(activePlayers.length);
  const rounds: AirHockeyBracketMatch[][] = [];
  const firstRound: AirHockeyBracketMatch[] = [];

  for (let index = 0; index < bracketSize; index += 2) {
    firstRound.push(
      makeMatch(
        0,
        index / 2,
        normalizeSlot(activePlayers[index]),
        normalizeSlot(activePlayers[index + 1]),
      ),
    );
  }
  rounds.push(firstRound);

  let matchCount = firstRound.length / 2;
  let roundIndex = 1;
  while (matchCount >= 1) {
    const round: AirHockeyBracketMatch[] = [];
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      round.push(makeMatch(roundIndex, matchIndex));
    }
    rounds.push(round);
    matchCount /= 2;
    roundIndex += 1;
  }

  return advanceAutomaticByes({
    version: 1,
    generatedAt: now.toISOString(),
    rounds,
    championId: null,
  });
}

function clearDownstreamWinners(
  bracket: AirHockeyBracket,
  startingRoundIndex: number,
): AirHockeyBracket {
  for (
    let roundIndex = startingRoundIndex + 1;
    roundIndex < bracket.rounds.length;
    roundIndex += 1
  ) {
    for (const match of bracket.rounds[roundIndex] ?? []) {
      match.winnerId = null;
      match.slot1 = { playerId: null, name: "TBD" };
      match.slot2 = { playerId: null, name: "TBD" };
    }
  }
  bracket.championId = null;
  return bracket;
}

function slotHasPlayer(slot: AirHockeyBracketSlot): boolean {
  return Boolean(slot.playerId) && !slot.isBye;
}

export function advanceAutomaticByes(
  bracket: AirHockeyBracket,
): AirHockeyBracket {
  const playersById = new Map<string, AirHockeyBracketPlayer>();
  for (const round of bracket.rounds) {
    for (const match of round) {
      for (const slot of [match.slot1, match.slot2]) {
        if (slot.playerId && !slot.isBye) {
          playersById.set(slot.playerId, { id: slot.playerId, name: slot.name });
        }
      }
    }
  }

  for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex += 1) {
    for (const match of bracket.rounds[roundIndex] ?? []) {
      const slot1HasPlayer = slotHasPlayer(match.slot1);
      const slot2HasPlayer = slotHasPlayer(match.slot2);
      if (!match.winnerId && slot1HasPlayer !== slot2HasPlayer) {
        match.winnerId = (slot1HasPlayer ? match.slot1 : match.slot2).playerId;
      }
      if (match.winnerId) {
        advanceWinnerInPlace(
          bracket,
          roundIndex,
          match.matchIndex,
          match.winnerId,
          findPlayerName([...playersById.values()], match.winnerId),
        );
      }
    }
  }

  return bracket;
}

function advanceWinnerInPlace(
  bracket: AirHockeyBracket,
  roundIndex: number,
  matchIndex: number,
  winnerId: string,
  winnerName: string,
) {
  const nextRound = bracket.rounds[roundIndex + 1];
  if (!nextRound) {
    bracket.championId = winnerId;
    return;
  }

  const nextMatch = nextRound[Math.floor(matchIndex / 2)];
  if (!nextMatch) return;
  const slot = matchIndex % 2 === 0 ? "slot1" : "slot2";
  nextMatch[slot] = { playerId: winnerId, name: winnerName };
}

function cloneBracket(bracket: AirHockeyBracket): AirHockeyBracket {
  return JSON.parse(JSON.stringify(bracket)) as AirHockeyBracket;
}

export function setAirHockeyMatchWinner(
  bracket: AirHockeyBracket,
  matchId: string,
  winnerId: string,
): AirHockeyBracket {
  const next = clearDownstreamWinners(cloneBracket(bracket), 0);
  const targetRoundIndex = bracket.rounds.findIndex((round) =>
    round.some((match) => match.id === matchId),
  );
  if (targetRoundIndex < 0) throw new Error("Match was not found.");
  const players: AirHockeyBracketPlayer[] = [];
  for (const round of bracket.rounds) {
    for (const match of round) {
      for (const slot of [match.slot1, match.slot2]) {
        if (slot.playerId && !slot.isBye) {
          players.push({ id: slot.playerId, name: slot.name });
        }
      }
    }
  }

  for (let roundIndex = 0; roundIndex < next.rounds.length; roundIndex += 1) {
    for (const match of next.rounds[roundIndex] ?? []) {
      const original = bracket.rounds[roundIndex]?.[match.matchIndex];
      if (match.id === matchId) {
        const allowed = [match.slot1.playerId, match.slot2.playerId].includes(
          winnerId,
        );
        if (!allowed) throw new Error("Winner must be assigned to the match.");
        match.winnerId = winnerId;
      } else if (roundIndex < targetRoundIndex && original?.winnerId) {
        match.winnerId = original.winnerId;
      }
      if (match.winnerId) {
        advanceWinnerInPlace(
          next,
          roundIndex,
          match.matchIndex,
          match.winnerId,
          findPlayerName(players, match.winnerId),
        );
      }
    }
  }

  return advanceAutomaticByes(next);
}

export function updateFirstRoundAssignments(
  bracket: AirHockeyBracket,
  assignments: readonly (string | null)[],
  players: readonly AirHockeyBracketPlayer[],
): AirHockeyBracket {
  const next = cloneBracket(bracket);
  const seen = new Set<string>();
  const slots = next.rounds[0]?.flatMap((match) => [match.slot1, match.slot2]);
  if (!slots) return next;

  slots.forEach((slot, index) => {
    const playerId = assignments[index] ?? null;
    if (!playerId) {
      slot.playerId = null;
      slot.name = "Bye";
      slot.isBye = true;
      return;
    }
    if (seen.has(playerId)) throw new Error("A player can only appear once.");
    const player = players.find((item) => item.id === playerId);
    if (!player) throw new Error("Unknown player assignment.");
    seen.add(playerId);
    slot.playerId = player.id;
    slot.name = player.name;
    delete slot.isBye;
  });

  return advanceAutomaticByes(clearDownstreamWinners(next, 0));
}
