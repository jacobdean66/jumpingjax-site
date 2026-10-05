begin transaction read only;
select jsonb_build_object(
 'checked_at', now(),
 'schedule_table', to_regclass('public.social_meta_scheduled_publications'),
 'schedule_functions', (select jsonb_agg(proname) from pg_proc where pronamespace='public'::regnamespace and proname in ('create_social_meta_scheduled_publication','claim_due_social_meta_scheduled_publications','finish_social_meta_scheduled_publication')),
 'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in ('20260831230000','20260904153000','20260925130000','20260930173000','20260930180000')),
 'targets', (select jsonb_agg(jsonb_build_object('id',publication_target_id,'platform',platform,'enabled',enabled,'capabilities',capabilities,'media',media_constraints,'copy',copy_constraints)) from public.social_publication_targets),
 'sessions', (select jsonb_agg(x) from (select publication_target_id,lifecycle_state,count(*) from public.social_oauth_sessions group by 1,2) x),
 'bindings', (select jsonb_agg(x) from (select asset_kind,binding_state,count(*) from public.social_meta_publication_target_bindings group by 1,2) x),
 'calls', (select jsonb_build_object('stored',count(*),'native',count(*) filter(where provider_call_id like 'wacid.%'),'recordings',count(*) filter(where voicemail_media_id is not null)) from public.answering_machine_calls),
 'booking_columns', (select jsonb_agg(column_name) from information_schema.columns where table_schema='public' and table_name='answering_machine_calls' and column_name like '%booking%'),
 'permissions', (select jsonb_agg(jsonb_build_object('function',proname,'security_definer',prosecdef,'anon',has_function_privilege('anon',oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),'service',has_function_privilege('service_role',oid,'EXECUTE'))) from pg_proc where pronamespace='public'::regnamespace and proname in ('upsert_whatsapp_answering_call','record_whatsapp_answering_voicemail','create_social_meta_scheduled_publication','claim_due_social_meta_scheduled_publications','finish_social_meta_scheduled_publication'))
) as evidence;
commit;
