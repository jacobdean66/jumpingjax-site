alter table public.social_posts
add column if not exists original_image_url text null,
add column if not exists approved_image_url text null,
add column if not exists generated_image_url text null,
add column if not exists image_generation_provider text null,
add column if not exists image_generation_model text null,
add column if not exists image_prediction_id text null,
add column if not exists image_generation_created_at timestamptz null,
add column if not exists image_generation_prompt text null,
add column if not exists image_generation_status text null
  check (
    image_generation_status is null
    or image_generation_status in (
      'starting',
      'processing',
      'succeeded',
      'failed',
      'canceled'
    )
  );

create index if not exists social_posts_image_prediction_id_idx
  on public.social_posts (image_prediction_id)
  where image_prediction_id is not null;
