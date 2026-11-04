import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("the queue fences concurrent work, owner cancellation and stale completions", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls");
    const migration = new URL("../../supabase/migrations/20261104235900_qwen_pilot_queue.sql", import.meta.url);
    await db.exec(await readFile(migration, "utf8"));
    await db.exec(`
      do $test$ begin
        assert not has_table_privilege('authenticated', 'public.qwen_pilot_jobs', 'SELECT');
        assert not has_function_privilege('anon', 'public.claim_qwen_pilot_job()', 'EXECUTE');
      end $test$;
      set role service_role;
      do $test$
      declare
        first_id uuid;
        second_id uuid;
        first_lease uuid;
        second_lease uuid;
      begin
        insert into public.qwen_pilot_jobs (owner_id, request_id)
          values ('owner-a', gen_random_uuid()) returning id into first_id;
        select lease into first_lease from public.claim_qwen_pilot_job() where job_id = first_id;
        assert first_lease is not null;
        insert into public.qwen_pilot_jobs (owner_id, request_id)
          values ('owner-b', gen_random_uuid()) returning id into second_id;
        assert not exists (select 1 from public.claim_qwen_pilot_job());
        assert public.renew_qwen_pilot_job(first_id, first_lease);
        assert not public.cancel_qwen_pilot_job('owner-b', first_id);
        assert public.cancel_qwen_pilot_job('owner-a', first_id);
        assert not public.renew_qwen_pilot_job(first_id, first_lease);
        assert not exists (select 1 from public.claim_qwen_pilot_job());
        assert public.finish_qwen_pilot_job(first_id, first_lease, 'qwen3:8b', null);
        assert (select status = 'cancelled' and model is null from public.qwen_pilot_jobs where id = first_id);
        select lease into second_lease from public.claim_qwen_pilot_job() where job_id = second_id;
        assert second_lease is not null;
        update public.qwen_pilot_jobs set lease_expires_at = clock_timestamp() - interval '1 second'
          where id = second_id;
        assert not public.finish_qwen_pilot_job(second_id, second_lease, 'qwen3:8b', null);
        perform public.claim_qwen_pilot_job();
        assert (select status = 'failed' and failure = 'worker_lost' from public.qwen_pilot_jobs where id = second_id);
      end $test$;
    `);
  } finally {
    await db.close();
  }
});
