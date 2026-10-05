import fs from "node:fs";
const source = "supabase/migrations/20261005170000_rental_agreement_delivery_paper.sql";
const sql = fs.readFileSync(source, "utf8");
const tag = "$jax_agreement_release$";
if (sql.includes(tag)) throw new Error("Migration delimiter conflict.");
fs.mkdirSync(".vercel", { recursive: true });
fs.writeFileSync(".vercel/rental-agreement-migration.sql", `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('20261005170000','rental_agreement_delivery_paper',array[${tag}${sql}${tag}]);\ncommit;\n`);
console.log("Prepared the agreement migration and its history entry as one transaction.");
