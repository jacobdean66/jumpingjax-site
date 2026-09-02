alter table public.booking_notification_outbox
  add column if not exists html_body text null;
