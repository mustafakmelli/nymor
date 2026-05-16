import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import pc from "picocolors";
import { compileCommand } from "./compile";
import { extractSkillTarball, fetchSkillIndex, fetchSkillTarball, getSkillTarballUrl } from "../registry/client";
import { getCachedIndex, getCachedTarball, putCachedIndex, putCachedTarball } from "../registry/cache";
import { resolveVersion } from "../registry/resolver";
import { SkillRegistryIndex } from "../registry/types";
import { CicadaLock, readLockfile, readManifest, writeLockfile, writeManifest } from "../utils/manifest";
import { getSkillsDir } from "../utils/paths";

const INDEX_TTL_MS = 60 * 60 * 1000;

interface AddOptions {
  version?: string;
  offline?: boolean;
}

export interface RegistrySkillName {
  packageName: string;
  scope: string;
  name: string;
  folderName: string;
}

export interface InstallResult {
  packageName: string;
  version: string;
  integrity: string;
  resolved: string;
  destinationDir: string;
}

export async function addCommand(skill: string, options: AddOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseRegistrySkill(skill);
  const manifest = await readManifest(projectRoot);

  if (manifest.skills[parsed.packageName]) {
    console.log(pc.yellow(`Skill ${parsed.packageName} is already in cicada.json; reinstalling.`));
  }

  const requestedRange = options.version ?? "latest";
  const result = await installRegistrySkill(projectRoot, parsed, requestedRange, Boolean(options.offline));

  manifest.skills[parsed.packageName] = requestedRange;
  await writeManifest(projectRoot, manifest);

  const lockfile = (await readLockfile(projectRoot)) ?? createEmptyLockfile();
  lockfile.skills[parsed.packageName] = {
    version: result.version,
    integrity: result.integrity,
    resolved: result.resolved
  };
  await writeLockfile(projectRoot, lockfile);

  await compileCommand();

  console.log("");
  console.log(`${pc.green("✓")} Installed ${result.packageName}@${result.version}`);
  console.log(`  ${result.destinationDir}`);
}

export async function installRegistrySkill(
  projectRoot: string,
  parsed: RegistrySkillName,
  range: string,
  offline: boolean
): Promise<InstallResult> {
  const index = await getSkillIndex(parsed, offline);
  const version = resolveVersion(range, Object.keys(index.versions));
  const registryVersion = index.versions[version];

  if (!registryVersion) {
    throw new Error(`Registry index for ${parsed.packageName} does not include ${version}`);
  }

  const { tarball, integrity } = await getTarball(parsed, version, registryVersion.integrity, offline);
  const destinationDir = path.join(getSkillsDir(projectRoot), parsed.folderName);

  await fs.emptyDir(destinationDir);
  await extractSkillTarball(tarball, destinationDir);

  const skillPath = path.join(destinationDir, "SKILL.md");
  if (!(await fs.pathExists(skillPath))) {
    throw new Error(`Installed tarball for ${parsed.packageName}@${version} did not contain SKILL.md`);
  }

  return {
    packageName: parsed.packageName,
    version,
    integrity,
    resolved: getSkillTarballUrl(parsed.scope, parsed.name, version),
    destinationDir
  };
}

export function parseRegistrySkill(value: string): RegistrySkillName {
  const match = /^(@[^/\s]+)\/([^/\s]+)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid skill "${value}". Expected a scoped package like @cicada/commit-conventions.`);
  }

  const [, scope, name] = match;
  return {
    packageName: `${scope}/${name}`,
    scope,
    name,
    folderName: `${scope}__${name}`
  };
}

export function createEmptyLockfile(): CicadaLock {
  return {
    lockfileVersion: 1,
    skills: {}
  };
}

export function computeTarballIntegrity(tarball: Buffer): string {
  return `sha256-${crypto.createHash("sha256").update(tarball).digest("base64")}`;
}

async function getSkillIndex(parsed: RegistrySkillName, offline: boolean): Promise<SkillRegistryIndex> {
  const cacheKey = parsed.folderName;
  const cached = await getCachedIndex(cacheKey, offline ? Number.POSITIVE_INFINITY : INDEX_TTL_MS);
  if (cached) {
    return cached as SkillRegistryIndex;
  }

  if (offline) {
    throw new Error(`No cached registry index for ${parsed.packageName}; cannot add in offline mode.`);
  }

  const index = await fetchSkillIndex(parsed.scope, parsed.name);
  await putCachedIndex(cacheKey, index);
  return index;
}

async function getTarball(
  parsed: RegistrySkillName,
  version: string,
  expectedIntegrity: string,
  offline: boolean
): Promise<{ tarball: Buffer; integrity: string }> {
  const cached = await getCachedTarball(parsed.scope, parsed.name, version);
  if (cached) {
    const cachedIntegrity = computeTarballIntegrity(cached);
    if (cachedIntegrity !== expectedIntegrity) {
      throw new Error(
        `Cached tarball integrity mismatch for ${parsed.packageName}@${version}: expected ${expectedIntegrity}, got ${cachedIntegrity}`
      );
    }

    return { tarball: cached, integrity: cachedIntegrity };
  }

  if (offline) {
    throw new Error(`No cached tarball for ${parsed.packageName}@${version}; cannot add in offline mode.`);
  }

  const fetched = await fetchSkillTarball(parsed.scope, parsed.name, version);
  if (fetched.integrity !== expectedIntegrity) {
    throw new Error(
      `Registry integrity mismatch for ${parsed.packageName}@${version}: index has ${expectedIntegrity}, integrity.txt has ${fetched.integrity}`
    );
  }
  await putCachedTarball(parsed.scope, parsed.name, version, fetched.tarball, fetched.integrity);
  return fetched;
}
