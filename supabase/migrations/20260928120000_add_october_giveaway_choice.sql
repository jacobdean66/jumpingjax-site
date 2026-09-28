alter table public.giveaway_nominations
  drop constraint if exists giveaway_nominations_party_choice_check;

alter table public.giveaway_nominations
  add constraint giveaway_nominations_party_choice_check
  check (party_choice in ('september_birthday', 'back_to_school', 'october_halloween'));
