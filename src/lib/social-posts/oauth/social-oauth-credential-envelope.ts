import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SOCIAL_OAUTH_ENVELOPE_VERSION = "aes-256-gcm-v1" as const;

export type SocialOAuthEncryptedEnvelope = Readonly<{
  version: typeof SOCIAL_OAUTH_ENVELOPE_VERSION;
  keyVersion: string;
  nonce: string;
  ciphertext: string;
  tag: string;
}>;

export function encryptOAuthSecret(
  plaintext: string,
  masterKey: Buffer,
  keyVersion = "vault-master-v1",
): SocialOAuthEncryptedEnvelope {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    version: SOCIAL_OAUTH_ENVELOPE_VERSION,
    keyVersion,
    nonce: nonce.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptOAuthSecret(
  envelope: SocialOAuthEncryptedEnvelope,
  masterKey: Buffer,
): string {
  if (envelope.version !== SOCIAL_OAUTH_ENVELOPE_VERSION) {
    throw new Error("Unsupported OAuth envelope version.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey,
    Buffer.from(envelope.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function serializeOAuthEnvelope(envelope: SocialOAuthEncryptedEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function hydrateOAuthEnvelope(serialized: string): SocialOAuthEncryptedEnvelope {
  const parsed = JSON.parse(
    Buffer.from(serialized, "base64url").toString("utf8"),
  ) as SocialOAuthEncryptedEnvelope;
  if (parsed.version !== SOCIAL_OAUTH_ENVELOPE_VERSION) {
    throw new Error("Unsupported OAuth envelope version.");
  }
  return parsed;
}
