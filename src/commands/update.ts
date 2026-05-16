import semver from "semver";
import pc from "picocolors";
import { compileCommand } from "./compile";
import { createEmptyLockfile, installRegistrySkill, parseRegistrySkill } from "./add";
import { fetchSkillIndex } from "../registry/client";
import { getCachedIndex, putCachedIndex } from "../registry/cache";
import { resolveVersion } from "../registry/resolver";
import { SkillRegistryIndex } from "../registry/types";
import { readLockfile, readManifest, writeLockfile } from "../utils/manifest";

const INDEX_TTL_MS = 60 * 60 * 1000;

interface UpdateOptions {
  latest?: boolean;
}

interface UpdateRow {
  skill: string;
  oldVersion: string;
  newVersion: string;
  changed: boolean;
}

export async function updateCommand(skill?: string, options: UpdateOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const manifest = await readManifest(projectRoot);
  const lockfile = (await readLockfile(projectRoot)) ?? createEmptyLockfile();
  const targets = skill ? [skill] : Object.keys(manifest.skills);
  const rows: UpdateRow[] = [];
  let changed = false;

  if (targets.length === 0) {
    console.log("No registry skills installed.");
    return;
  }

  for (const target of targets) {
    const parsed = parseRegistrySkill(target);
    const manifestRange = manifest.skills[parsed.packageName];

    if (!manifestRange) {
      throw new Error(`Skill ${parsed.packageName} is not installed.`);
    }

    const index = await getFreshSkillIndex(parsed.scope, parsed.name, parsed.folderName);
    const range = options.latest ? "latest" : manifestRange;
    const nextVersion = resolveVersion(range, Object.keys(index.versions));
    const lockedVersion = lockfile.skills[parsed.packageName]?.version ?? "none";
    const shouldInstall =
      lockedVersion === "none" ||
      !semver.valid(lockedVersion) ||
      semver.gt(nextVersion, lockedVersion);

    if (shouldInstall) {
      const result = await installRegistrySkill(projectRoot, parsed, range, false);
      lockfile.skills[parsed.packageName] = {
        version: result.version,
        integrity: result.integrity,
        resolved: result.resolved
      };
      changed = true;
    }

    rows.push({
      skill: parsed.packageName,
      oldVersion: lockedVersion,
      newVersion: shouldInstall ? nextVersion : lockedVersion,
      changed: shouldInstall
    });
  }

  if (changed) {
    await writeLockfile(projectRoot, lockfile);
    await compileCommand();
  }

  printRows(rows);
}

async function getFreshSkillIndex(scope: string, name: string, cacheKey: string): Promise<SkillRegistryIndex> {
  const cached = await getCachedIndex(cacheKey, INDEX_TTL_MS);
  if (cached) {
    return cached as SkillRegistryIndex;
  }

  const index = await fetchSkillIndex(scope, name);
  await putCachedIndex(cacheKey, index);
  return index;
}

function printRows(rows: UpdateRow[]): void {
  const skillWidth = Math.max("Skill".length, ...rows.map((row) => row.skill.length));
  const oldWidth = Math.max("Old".length, ...rows.map((row) => row.oldVersion.length));

  console.log(`${"Skill".padEnd(skillWidth)}  ${"Old".padEnd(oldWidth)}  New`);
  console.log(`${"-".repeat(skillWidth)}  ${"-".repeat(oldWidth)}  ---`);

  for (const row of rows) {
    const marker = row.changed ? pc.green(row.newVersion) : row.newVersion;
    console.log(`${row.skill.padEnd(skillWidth)}  ${row.oldVersion.padEnd(oldWidth)}  ${marker}`);
  }
}
