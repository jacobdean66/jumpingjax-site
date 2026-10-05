select version from supabase_migrations.schema_migrations where version >= '20261004000000' order by version;
select column_name from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='rental_day_charges';
select column_name from information_schema.columns where table_schema='public' and table_name='rental_agreements' and column_name in ('signature_method','paper_copy_path');
select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename='objects';
