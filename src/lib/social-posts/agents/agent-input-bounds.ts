export const AGENT_INPUT_LIMITS = {
  goal: 400,
  audience: 240,
  tone: 160,
  callToAction: 240,
  seasonalContext: 800,
  assetContext: 800,
  caption: 2_200,
  title: 160,
  prompt: 4_500,
  hashtagBlock: 400,
  notes: 800,
  platformNotes: 600,
  keyword: 40,
  keywordCount: 8,
  stringArrayItem: 240,
  stringArrayCount: 12,
  idempotencyKey: 128,
} as const;

export class AgentInputValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "AgentInputValidationError";
  }
}

export function boundOptionalText(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new AgentInputValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new AgentInputValidationError(
      `${field} exceeds the ${max}-character limit.`,
    );
  }
  return trimmed;
}

export function boundRequiredText(
  value: unknown,
  field: string,
  max: number,
): string {
  const next = boundOptionalText(value, field, max);
  if (!next) {
    throw new AgentInputValidationError(`${field} is required.`);
  }
  return next;
}

export function boundNullableText(
  value: unknown,
  field: string,
  max: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return boundOptionalText(value, field, max) ?? null;
}

export function rejectUnknownKeys(
  raw: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(raw).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new AgentInputValidationError(
      `${label} contains unknown keys: ${unknown.slice(0, 8).join(", ")}.`,
    );
  }
}

export function requireExactStringArray(
  value: unknown,
  field: string,
  options: {
    min: number;
    max: number;
    itemMax: number;
    allowedValues?: readonly string[];
  },
): string[] {
  if (!Array.isArray(value)) {
    throw new AgentInputValidationError(`${field} must be an array.`);
  }
  if (value.length < options.min || value.length > options.max) {
    throw new AgentInputValidationError(
      `${field} must contain between ${options.min} and ${options.max} items.`,
    );
  }

  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new AgentInputValidationError(
        `${field} contains an invalid non-string member.`,
      );
    }
    const trimmed = item.trim();
    if (trimmed.length > options.itemMax) {
      throw new AgentInputValidationError(
        `${field} item exceeds ${options.itemMax} characters.`,
      );
    }
    if (
      options.allowedValues &&
      !options.allowedValues.includes(trimmed)
    ) {
      throw new AgentInputValidationError(
        `${field} contains unsupported value "${trimmed}".`,
      );
    }
    out.push(trimmed);
  }
  return out;
}

/** Hard deterministic scan for fabricated business claims in free text. */
export function scanProhibitedBusinessClaims(text: string): string[] {
  const findings: string[] = [];
  const lower = text.toLowerCase();

  if (/\$\s*\d/.test(text) || /\b\d+\s*(usd|dollars?)\b/i.test(text)) {
    findings.push("Contains a price-like claim that requires owner-authorized facts.");
  }
  if (
    /\b(free\s+(rental|rentals|booking|delivery|upgrade)|discount|%\s*off|promotions?|promo\s+code|special\s+deal|coupon)\b/i.test(
      lower,
    )
  ) {
    findings.push("Contains a promotion/discount claim that requires owner authorization.");
  }
  if (
    /\b(available\s+now|in\s+stock|limited\s+spots?|only\s+\d+\s+left|last\s+chance|book\s+today\s+only)\b/i.test(
      lower,
    )
  ) {
    findings.push("Contains availability/scarcity language that requires verified facts.");
  }
  if (/\b(guarantee[ds]?|promise[ds]?|always\s+available|never\s+booked)\b/i.test(lower)) {
    findings.push("Contains a guarantee-style claim that is prohibited without owner facts.");
  }
  if (
    /\b(opens?|closes?)\s+on\s+(\d{1,2}([\/\-]\d{1,2})?|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|[a-z]{3,9}\s+\d{1,2})\b/i.test(
      lower,
    ) ||
    /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      lower,
    ) ||
    /\bthrough\s+[a-z]{3,9}\s+\d{1,2}\b/i.test(lower)
  ) {
    findings.push("Contains a date-like claim that requires owner confirmation.");
  }

  return findings;
}
