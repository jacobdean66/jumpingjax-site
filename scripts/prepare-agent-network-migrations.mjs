import { readFile, writeFile, mkdir } from "node:fs/promises";
// Prepare only this feature's additive migrations; do not replay unrelated history.
const migrations = [
  ["20261004224300", "create_agent_network"],
  ["20261004224310", "agent_network_recovery"],
];
const quote = (text) => "'" + text.replaceAll("'", "''") + "'";
let sql = "begin;\nselect pg_advisory_xact_lock(hashtext('jumpingjax-agent-network-migration'));\n";
sql += "do $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version in (" + migrations.map(([version]) => quote(version)).join(",") + ")) then raise exception 'agent network migration version already recorded'; end if; end $$;\n";
for (const [version, name] of migrations) {
  const source = await readFile(new URL("../supabase/migrations/" + version + "_" + name + ".sql", import.meta.url), "utf8");
  sql += source + "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(" + quote(version) + "," + quote(name) + ",array[" + quote(source) + "]::text[]);\n";
}
sql += "notify pgrst, 'reload schema';\ncommit;\n";
const directory = new URL("../tmp/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("agent-network-activation.sql", directory), sql);
console.log("Prepared tmp/agent-network-activation.sql: two additive migrations in one transaction.");
