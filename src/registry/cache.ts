import os from "os";
import path from "path";
import fs from "fs-extra";

export async function getCachedTarball(scope: string, name: string, version: string): Promise<Buffer | null> {
  const tarballPath = getTarballPath(scope, name, version);
  if (!(await fs.pathExists(tarballPath))) {
    return null;
  }

  return fs.readFile(tarballPath);
}

export async function putCachedTarball(
  scope: string,
  name: string,
  version: string,
  tarball: Buffer,
  integrity: string
): Promise<void> {
  const dir = getSkillVersionCacheDir(scope, name, version);
  await fs.ensureDir(dir);
  await fs.writeFile(path.join(dir, "SKILL.tar.gz"), tarball);
  await fs.writeFile(path.join(dir, "integrity.txt"), `${integrity}\n`, "utf8");
}

export async function getCachedIndex(key: string, ttlMs: number): Promise<unknown | null> {
  const indexPath = getIndexPath(key);
  if (!(await fs.pathExists(indexPath))) {
    return null;
  }

  const stat = await fs.stat(indexPath);
  if (Date.now() - stat.mtimeMs > ttlMs) {
    return null;
  }

  return fs.readJson(indexPath);
}

export async function putCachedIndex(key: string, value: unknown): Promise<void> {
  const indexPath = getIndexPath(key);
  await fs.ensureDir(path.dirname(indexPath));
  await fs.writeJson(indexPath, value, { spaces: 2 });
}

function getTarballPath(scope: string, name: string, version: string): string {
  return path.join(getSkillVersionCacheDir(scope, name, version), "SKILL.tar.gz");
}

function getSkillVersionCacheDir(scope: string, name: string, version: string): string {
  return path.join(getCacheRoot(), "skills", formatSkillCacheKey(scope, name), version);
}

function getIndexPath(key: string): string {
  const fileName = key === "root" ? "root.json" : `${sanitizeCacheKey(key)}.json`;
  return path.join(getCacheRoot(), "index", fileName);
}

function getCacheRoot(): string {
  return path.join(process.env.HOME ?? os.homedir(), ".cicada", "cache");
}

function formatSkillCacheKey(scope: string, name: string): string {
  return `${scope}__${name}`;
}

function sanitizeCacheKey(key: string): string {
  return key.replace(/[\\/]/g, "__");
}
