import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const dir of ["server", "scripts"])
  for (const file of readdirSync(dir).filter((x) => x.endsWith(".mjs"))) {
    const result = spawnSync(process.execPath, ["--check", `${dir}/${file}`], {
      stdio: "inherit",
    });
    if (result.status) process.exit(result.status);
  }
console.log(
  "Node source syntax checks passed. Run npm run build to validate React sources.",
);
