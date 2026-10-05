import { createHash } from 'node:crypto';
import { LIBRARY_CATALOG_REVISION } from './local-theme';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { invitationArtworkBucket } from './artwork-bucket';
import { persistThemeArtwork } from './theme-artwork-store';
import { normalizeThemeLabel, themeCatalogQuery } from './theme-interpretations';
import { themeCandidateSchema, type ThemeCandidate, type ThemeSearchRequest } from './theme-search';
import { uncertainInvitationIdentity } from './artwork-policy';

type AssetRow = {
  id: string; label: string; description: string; storage_path: string;
  source_url: string; source_image_url: string; approval_status: string; franchise: string; aliases: string[];
};

function candidateFromAsset(row: AssetRow): ThemeCandidate {
  return themeCandidateSchema.parse({ id: row.id, catalogAssetId: row.id, label: row.label,
    description: row.description, imageUrl: row.source_image_url, sourceUrl: row.source_url, franchise: row.franchise, aliases: row.aliases,
    imagePath: `/api/facility/invitations/artwork/${row.storage_path.replace(/\.png$/, '')}` });
}

export async function findCatalogThemes(input: ThemeSearchRequest): Promise<ThemeCandidate[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc('search_invitation_theme_assets', {
    p_query: themeCatalogQuery(input), p_bucket: invitationArtworkBucket(),
  });
  if (error) throw new Error('theme_catalog_lookup_failed');
  const rejected = new Set(input.rejected.map(normalizeThemeLabel));
  return (data as AssetRow[]).filter(row => !uncertainInvitationIdentity(row.label,row.description) && !rejected.has(normalizeThemeLabel(row.label))).slice(0, 4).map(candidateFromAsset);
}

/** Freeze verified pixels before showing them, so confirmation cannot fetch a changed remote image. */
export async function stageCatalogTheme(candidate: ThemeCandidate): Promise<ThemeCandidate> {
  const imagePath = await persistThemeArtwork(candidate.imageUrl);
  const storagePath = `${imagePath.split('/').pop()}.png`;
  const bucket = invitationArtworkBucket();
  const normalized = normalizeThemeLabel(candidate.label);
  const id = createHash('sha256').update(`${bucket}\n${normalized}\n${storagePath}`).digest('hex');
  const db = createServiceRoleClient();
  const { error } = await db.from('invitation_theme_assets').upsert({
    id, label: candidate.label, normalized_label: normalized, aliases: [...new Set([normalized, ...(candidate.aliases ?? []).map(normalizeThemeLabel)])],
    franchise: candidate.franchise ?? candidate.label, description: candidate.description,
    storage_bucket: bucket, storage_path: storagePath,
    source_url: candidate.sourceUrl, source_image_url: candidate.imageUrl,
    provenance: { method: candidate.sourceUrl.startsWith(`https://github.com/microsoft/fluentui-emoji/blob/${LIBRARY_CATALOG_REVISION}/`) ? 'licensed-repository-catalog' : candidate.sourceUrl.startsWith('https://en.wikipedia.org/wiki/') ? 'team-directory-selection' : 'protected-provider-search', version: 2 },
    approval_status: 'pending',
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('theme_catalog_write_failed');
  return { ...candidate, id, catalogAssetId: id, imagePath };
}

export async function approveCatalogTheme(candidate: ThemeCandidate): Promise<string> {
  // Older, still-valid selection tokens can complete through the same catalog.
  const staged = candidate.catalogAssetId ? candidate : await stageCatalogTheme(candidate);
  const db = createServiceRoleClient();
  const { data, error } = await db.from('invitation_theme_assets').select('*')
    .eq('id', staged.catalogAssetId!).eq('storage_bucket', invitationArtworkBucket()).single<AssetRow>();
  if (error || !data || data.approval_status === 'rejected') throw new Error('theme_catalog_confirmation_failed');
  if (uncertainInvitationIdentity(data.label,data.description)) throw new Error('theme_identity_uncertain');
  const stored = candidateFromAsset(data);
  if (stored.imagePath !== staged.imagePath || stored.label !== staged.label) throw new Error('theme_catalog_confirmation_failed');
  const { data: image, error: imageError } = await db.storage.from(invitationArtworkBucket()).download(data.storage_path);
  if (imageError || !image || image.size < 8) throw new Error('theme_artwork_missing');
  const png = Buffer.from(await image.arrayBuffer());
  const signature = png.subarray(0,8).toString('hex');
  if (createHash('sha256').update(png).digest('hex') + '.png' !== data.storage_path) throw new Error('theme_artwork_invalid');
  if (signature !== '89504e470d0a1a0a') throw new Error('theme_artwork_invalid');
  const now = new Date().toISOString();
  const { error: approvalError } = await db.from('invitation_theme_assets')
    .update({ approval_status: 'approved', approved_at: now, updated_at: now })
    .eq('id', data.id).neq('approval_status', 'rejected').select('id').single();
  if (approvalError) throw new Error('theme_catalog_confirmation_failed');
  return stored.imagePath!;
}
