import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const modes = {
  all: ["git", "--redact", "--no-banner", "."],
  staged: ["git", "--pre-commit", "--staged", "--redact", "--no-banner", "."],
} as const;

const mode = process.argv[2];
if (mode !== "all" && mode !== "staged") {
  process.stderr.write("Usage: node scripts/gitleaks.ts all|staged\n");
  process.exit(2);
}

// winget puts gitleaks in its Links folder, which some terminals leave off PATH.
function findGitleaks(): string | null {
  if (!spawnSync("gitleaks", ["version"], { stdio: "ignore" }).error) return "gitleaks";
  const linked = path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "gitleaks.exe");
  return process.env.LOCALAPPDATA && existsSync(linked) ? linked : null;
}

const gitleaks = findGitleaks();
if (!gitleaks) {
  process.stderr.write(
    "Secret scan failed: gitleaks is not installed or could not be found.\n" +
      "Install it with: winget install Gitleaks.Gitleaks\n" +
      "This repo is public, so the scan cannot be skipped.\n",
  );
  process.exit(1);
}

const result = spawnSync(gitleaks, modes[mode], { stdio: "inherit" });
if (result.error || result.status !== 0) {
  process.stderr.write("Secret scan failed. Fix the findings above before committing or pushing.\n");
  process.exit(1);
}
