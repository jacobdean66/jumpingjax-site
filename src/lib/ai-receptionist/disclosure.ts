import {
  AI_RECEPTIONIST_DISCLOSURE_VERSION,
  type AiReceptionistConfig,
} from "./config";

export const AI_DISCLOSURE_TEXT =
  "Hi, thanks for calling Jumping Jax. This is an AI assistant speaking with a voice similar to Jacob's. I can help with rental questions, check availability, and start a booking request. I can also connect you to a person anytime — just ask.";

export function buildDisclosureUtterance(
  config?: Pick<AiReceptionistConfig, "disclosureVersion">,
): { text: string; version: string } {
  return {
    text: AI_DISCLOSURE_TEXT,
    version: config?.disclosureVersion ?? AI_RECEPTIONIST_DISCLOSURE_VERSION,
  };
}

export function ensureDisclosureSpoken(disclosureSpoken: boolean): {
  required: boolean;
  text: string;
  version: string;
} {
  const disclosure = buildDisclosureUtterance();
  return {
    required: !disclosureSpoken,
    text: disclosure.text,
    version: disclosure.version,
  };
}
