import fs from "fs-extra";
import { createDefaultManifest } from "../templates/cicada-json";
import { getLockPath, getManifestPath } from "./paths";

export type AgentTarget = "claude" | "cursor" | "copilot" | "kiro" | "agents-md";

export interface CicadaManifest {
  version: string;
  agents: AgentTarget[];
  skills: Record<string, string>;
  local: string[];
}

export interface LockEntry {
  version: string;
  integrity: string;
  resolved: string;
}

export interface CicadaLock {
  lockfileVersion: number;
  skills: Record<string, LockEntry>;
}

export async function readManifest(projectRoot: string): Promise<CicadaManifest> {
  const manifestPath = getManifestPath(projectRoot);
  if (!(await fs.pathExists(manifestPath))) {
    return createDefaultManifest() as CicadaManifest;
  }

  const manifest = await fs.readJson(manifestPath);
  return normalizeManifest(manifest);
}

export async function writeManifest(projectRoot: string, manifest: CicadaManifest): Promise<void> {
  const manifestPath = getManifestPath(projectRoot);
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

export async function readLockfile(projectRoot: string): Promise<CicadaLock | null> {
  const lockPath = getLockPath(projectRoot);
  if (!(await fs.pathExists(lockPath))) {
    return null;
  }

  return fs.readJson(lockPath);
}

export async function writeLockfile(projectRoot: string, lockfile: CicadaLock): Promise<void> {
  const lockPath = getLockPath(projectRoot);
  await fs.writeJson(lockPath, lockfile, { spaces: 2 });
}

function normalizeManifest(raw: Partial<CicadaManifest>): CicadaManifest {
  const defaultManifest = createDefaultManifest();

  return {
    version: raw.version ?? defaultManifest.version,
    agents: (raw.agents ?? defaultManifest.agents) as AgentTarget[],
    skills: raw.skills ?? {},
    local: raw.local ?? []
  };
}
