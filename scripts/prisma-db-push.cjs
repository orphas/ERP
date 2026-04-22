const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(projectRoot, "prisma", "schema.prisma");
const prismaCliPath = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

if (!existsSync(schemaPath)) {
  console.error(`Prisma schema not found at ${schemaPath}`);
  process.exit(1);
}

if (!existsSync(prismaCliPath)) {
  console.error(`Prisma CLI not found at ${prismaCliPath}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [prismaCliPath, "db", "push", `--schema=${schemaPath}`, "--accept-data-loss"],
  {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
  }
);

process.exit(result.status ?? 1);