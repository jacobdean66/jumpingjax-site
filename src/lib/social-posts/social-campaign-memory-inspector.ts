import "server-only";

import {
  listSocialCampaignMemories,
  listSocialCampaignMemoryEvidence,
  type SocialCampaignMemory,
  type SocialCampaignMemoryEvidence,
  type SocialCampaignMemoryEvidenceRole,
} from "./social-campaign-memories";

export type SocialCampaignMemoryEvidenceGroup = {
  role: SocialCampaignMemoryEvidenceRole;
  evidence: SocialCampaignMemoryEvidence[];
};

export type SocialCampaignMemoryInspection = {
  memory: SocialCampaignMemory;
  evidence: SocialCampaignMemoryEvidence[];
  evidenceGroups: SocialCampaignMemoryEvidenceGroup[];
};

const EVIDENCE_ROLE_ORDER: SocialCampaignMemoryEvidenceRole[] = [
  "supporting",
  "contradicting",
  "neutral",
];

export function formatCampaignMemoryDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCampaignMemoryPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function groupCampaignMemoryEvidence(
  evidence: SocialCampaignMemoryEvidence[],
): SocialCampaignMemoryEvidenceGroup[] {
  return EVIDENCE_ROLE_ORDER.map((role) => ({
    role,
    evidence: evidence.filter((item) => item.evidence_role === role),
  })).filter((group) => group.evidence.length > 0);
}

export async function listCampaignMemoryInspections(): Promise<
  SocialCampaignMemoryInspection[]
> {
  const memories = await listSocialCampaignMemories();
  const inspections = await Promise.all(
    memories.map(async (memory) => {
      const evidence = await listSocialCampaignMemoryEvidence(memory.id);
      return {
        memory,
        evidence,
        evidenceGroups: groupCampaignMemoryEvidence(evidence),
      };
    }),
  );

  return inspections;
}
