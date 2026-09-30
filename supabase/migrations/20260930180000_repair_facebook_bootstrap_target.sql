-- Repair the known bootstrap row that the publication target validator rejects.
-- This changes descriptor shape only. OAuth, Page binding, owner approval,
-- execution authorization, and publish/schedule gates remain separate.
-- Preserve targets already repaired or changed by their owner.
update public.social_publication_targets
set capabilities = '["caption_text"]'::jsonb,
    media_constraints = '{
      "supportedMediaTypes": ["image"],
      "maxImageCount": 0,
      "maxVideoCount": 0,
      "maxVideoDurationSeconds": 0,
      "supportedAspectRatios": []
    }'::jsonb,
    copy_constraints = '{
      "maxCaptionCharacters": 2200,
      "supportsHashtags": false,
      "supportsLinks": false
    }'::jsonb,
    updated_at = now()
where publication_target_id = 'd9be61cc-137d-4f47-87c9-43023bc58c85'::uuid
  and platform = 'facebook'
  and target_type = 'facebook_page'
  and owner_managed = true
  and external_target_id = 'pending-meta-page-bootstrap'
  and capabilities = '["organic_publish"]'::jsonb
  and media_constraints = '{}'::jsonb
  and copy_constraints = '{}'::jsonb;

-- The existing descriptor requires at least one supported media type. The zero
-- media counts and caption_text-only capability do not enable image/video posts.
