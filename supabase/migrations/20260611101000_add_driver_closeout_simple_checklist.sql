alter table public.driver_closeout_reports
  add column if not exists out_of_slide_spray boolean not null default false,
  add column if not exists cash_payment boolean not null default false,
  add column if not exists credit_payment boolean not null default false,
  add column if not exists paid boolean not null default false,
  add column if not exists unpaid boolean not null default false,
  add column if not exists bought_gas boolean not null default false,
  add column if not exists bought_drinks boolean not null default false,
  add column if not exists customer_happy boolean not null default false;
