-- Idempotent Gmail audit backfill for Free Party Giveaway nominations (Aug 20, 2026).
-- Preserves existing rows. Uses verified audit UUIDs as primary keys.
-- Reasons for Aug 10–16 imports come from the verified Gmail export (PR #75).
-- Colton (Aug 19) reasons were not recoverable without inbox access; marked explicitly.

delete from public.giveaway_nominations
where id = 'e0c94bbb-8998-4c40-9303-3636c970603a';

insert into public.giveaway_nominations (
  id,
  idempotency_key,
  nominator_name,
  nominator_email,
  child_name,
  child_birth_month,
  child_birth_day,
  party_choice,
  nomination_reason,
  permission_acknowledged,
  confirmation_email_sent,
  owner_email_sent,
  created_at
)
values
  (
    '73823681-9e29-4bbe-b07d-5b8b3e1aea1f',
    'gmail-backfill:73823681-9e29-4bbe-b07d-5b8b3e1aea1f',
    'Christina Hjalmer',
    'christinahjalmer@hotmail.com',
    'Zane',
    8,
    16,
    'back_to_school',
    'Zane had a rough start to life and was placed in foster care at 11 months old. He’s now 11 and he has truly overcome so much! He is such a blessing to our family who adopted him! Everyone who meets Zane loves him for his spunky personality, kinesthetic self, huge smile and even bigger heart.',
    true,
    false,
    true,
    '2026-08-16T19:20:11.000Z'
  ),
  (
    'd23447dd-b917-48a3-bde9-397740ae535e',
    'gmail-backfill:d23447dd-b917-48a3-bde9-397740ae535e',
    'Demetria Williams',
    'demetriawilliams855@gmail.com',
    'Ki''Zion',
    2,
    27,
    'back_to_school',
    'He had his third birthday party would to have another party there',
    true,
    false,
    true,
    '2026-08-16T18:21:46.000Z'
  ),
  (
    'c9c5830a-94b0-4b5e-9877-7e73feea7765',
    'gmail-backfill:c9c5830a-94b0-4b5e-9877-7e73feea7765',
    'Justin Eakin',
    'justin.mmasters@gmail.com',
    'Kimber',
    5,
    29,
    'back_to_school',
    'I would love to treat my daughter and her friends to a party. They are all good kids that should be rewarded.',
    true,
    false,
    true,
    '2026-08-16T02:05:58.000Z'
  ),
  (
    '22412ba4-8611-48e3-ae07-bf2abb271f60',
    'gmail-backfill:22412ba4-8611-48e3-ae07-bf2abb271f60',
    'Karen Eakin',
    'kegunter@hotmail.com',
    'Kimber',
    5,
    29,
    'back_to_school',
    'My daughter has friends at different schools in the area. She doesn’t get to see them all as often as she would like. A back-to-school party in a common area to let them play together would mean so much to all of them.',
    true,
    false,
    true,
    '2026-08-16T01:54:55.000Z'
  ),
  (
    '2ed6875a-b345-48af-9e2e-0afc37fe49b2',
    'gmail-backfill:2ed6875a-b345-48af-9e2e-0afc37fe49b2',
    'Rhonda Landers',
    'epcalhoun@yahoo.com',
    'Turner',
    9,
    28,
    'september_birthday',
    'My grandson, Turner, loves coming to Jumping Jax! He will be 3 in September and already has a party scheduled there in September. Turner’s family and friends are very excited to celebrate with you at Jumping Jax and I know my son and daughter in law would love the opportunity to have his birthday party free of charge!',
    true,
    false,
    true,
    '2026-08-15T01:51:00.000Z'
  ),
  (
    '27be3e16-1da8-485a-a673-558ac9baaf6d',
    'gmail-backfill:27be3e16-1da8-485a-a673-558ac9baaf6d',
    'Rene Jobo',
    'renejobo@gmail.com',
    'Maddie',
    9,
    25,
    'september_birthday',
    'This party would make a meaningful difference in the child’s life by giving them a special day filled with joy, laughter, and memories they can treasure. It would allow the child to feel celebrated and remind them just how loved and important they are. The experience would bring happiness not only to the child, but also to their family and create a positive memory that they can look back on for years to come.',
    true,
    false,
    true,
    '2026-08-15T01:40:01.000Z'
  ),
  (
    '9c26d071-3415-4c69-84bc-15780f392bb8',
    'gmail-backfill:9c26d071-3415-4c69-84bc-15780f392bb8',
    'Carisa lingerfelt',
    'streetpro680@yahoo.com',
    'Avayah',
    9,
    16,
    'september_birthday',
    'I think she would love to have these.',
    true,
    false,
    true,
    '2026-08-14T15:54:27.000Z'
  ),
  (
    'f710e5e3-f5e9-4939-a937-208edeee1b82',
    'gmail-backfill:f710e5e3-f5e9-4939-a937-208edeee1b82',
    'Stephanie Long',
    'stephlong843@gmail.com',
    'Colton',
    9,
    26,
    'september_birthday',
    '[Nomination reason not recovered: Gmail body inaccessible during Aug 20, 2026 reconcile. Indexed metadata only: Colton, 09/26, September birthday, Stephanie Long.]',
    true,
    false,
    true,
    '2026-08-19T00:18:28.000Z'
  ),
  (
    'fa4a8750-a173-43b8-ae24-3670238f2a0c',
    'gmail-backfill:fa4a8750-a173-43b8-ae24-3670238f2a0c',
    'Candice Morris',
    'caldwellsr38@gmail.com',
    'Colton',
    9,
    26,
    'september_birthday',
    '[Nomination reason not recovered: Gmail body inaccessible during Aug 20, 2026 reconcile. Indexed metadata only: Colton, 09/26, September birthday, Candice Morris.]',
    true,
    false,
    true,
    '2026-08-19T00:20:41.000Z'
  )
on conflict (id) do nothing;
