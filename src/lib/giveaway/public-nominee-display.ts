/**
 * Public nominee wall may only show a child's first name and last initial.
 * Never pass birthdays, emails, nominator details, or nomination stories through this helper.
 */
export function formatPublicChildDisplayName(rawName: string): string {
  const parts = rawName
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z.'-]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "Nominee";

  const firstName = parts[0];
  if (parts.length === 1) {
    const maybeInitial = firstName.match(/^([A-Za-z])\.?$/);
    return maybeInitial ? `${maybeInitial[1].toUpperCase()}.` : firstName;
  }

  const lastToken = parts[parts.length - 1];
  const initialMatch = lastToken.match(/^([A-Za-z])/);
  if (!initialMatch) return firstName;

  return `${firstName} ${initialMatch[1].toUpperCase()}.`;
}

export function pickSecureRandomIndex(length: number): number {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("A nominee is required for the draw.");
  }

  const range = 2 ** 32;
  const limit = Math.floor(range / length) * length;
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);

  return value[0] % length;
}
