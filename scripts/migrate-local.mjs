import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const builtConfig = "dist/server/wrangler.json";
if (!existsSync(builtConfig)) {
  throw new Error("Run npm run build before applying local migrations.");
}
const config = JSON.parse(readFileSync(builtConfig, "utf8"));
const database = config.d1_databases?.find((entry) => entry.binding === "DB");
if (!database) throw new Error("The build has no DB binding.");
database.migrations_dir = resolve("drizzle");
const migrationConfig = "dist/server/local-migrations.json";
writeFileSync(migrationConfig, JSON.stringify(config, null, 2));
const result = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    migrationConfig,
    "--persist-to",
    ".wrangler/state",
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
