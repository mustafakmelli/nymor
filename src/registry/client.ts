import crypto from "crypto";
import fs from "fs-extra";
import os from "os";
import path from "path";
import * as tar from "tar";
import { RegistryRootIndex, SkillRegistryIndex } from "./types";

const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/cicada-skills/registry/main";

export async function fetchRootIndex(): Promise<RegistryRootIndex> {
  return fetchJson<RegistryRootIndex>(joinRegistryUrl("index.json"));
}

export async function fetchSkillIndex(scope: string, name: string): Promise<SkillRegistryIndex> {
  return fetchJson<SkillRegistryIndex>(joinRegistryUrl("skills", scope, name, "index.json"));
}

export async function fetchSkillTarball(
  scope: string,
  name: string,
  version: string
): Promise<{ tarball: Buffer; integrity: string }> {
  const tarballUrl = getSkillTarballUrl(scope, name, version);
  const integrityUrl = joinRegistryUrl("skills", scope, name, "versions", version, "integrity.txt");

  const [tarball, integrityText] = await Promise.all([
    fetchBuffer(tarballUrl),
    fetchText(integrityUrl)
  ]);
  const integrity = integrityText.trim();
  const computed = computeIntegrity(tarball);

  if (computed !== integrity) {
    throw new Error(`Integrity mismatch for ${scope}/${name}@${version}: expected ${integrity}, got ${computed}`);
  }

  return { tarball, integrity };
}

export async function extractSkillTarball(tarball: Buffer, destinationDir: string): Promise<void> {
  await fs.ensureDir(destinationDir);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-tarball-"));
  const tarballPath = path.join(tempDir, "SKILL.tar.gz");

  try {
    await fs.writeFile(tarballPath, tarball);
    const entryPaths: string[] = [];
    await tar.t({
      file: tarballPath,
      onentry: (entry) => {
        entryPaths.push(entry.path);
        entry.resume();
      }
    });

    await tar.x({
      file: tarballPath,
      cwd: destinationDir,
      strip: shouldStripLeadingDirectory(entryPaths) ? 1 : 0
    });
  } finally {
    await fs.remove(tempDir);
  }
}

export function getSkillTarballUrl(scope: string, name: string, version: string): string {
  return joinRegistryUrl("skills", scope, name, "versions", version, "SKILL.tar.gz");
}

export function computeIntegrity(value: Buffer): string {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
}

function getRegistryBaseUrl(): string {
  return (process.env.CICADA_REGISTRY_URL ?? DEFAULT_REGISTRY_URL).replace(/\/+$/, "");
}

function joinRegistryUrl(...segments: string[]): string {
  return `${getRegistryBaseUrl()}/${segments.map((segment) => segment.replace(/^\/+|\/+$/g, "")).join("/")}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { connection: "close" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { connection: "close" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { connection: "close" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function shouldStripLeadingDirectory(entryPaths: string[]): boolean {
  const files = entryPaths.filter((entryPath) => !entryPath.endsWith("/"));
  if (files.length === 0 || files.some((entryPath) => entryPath === "SKILL.md")) {
    return false;
  }

  const [firstSegment] = files[0].split("/");
  return Boolean(firstSegment) && files.every((entryPath) => entryPath.startsWith(`${firstSegment}/`));
}
