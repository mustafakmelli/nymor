import fs from "fs-extra";
import { AgentTarget, isAgentTarget } from "../agents/targets";
import { createDefaultManifest } from "../templates/nymor-json";
import { getManifestPath } from "./paths";

export interface NymorManifest {
  version: string;
  agents: AgentTarget[];
  local: string[];
}

export async function readManifest(projectRoot: string): Promise<NymorManifest> {
  const manifestPath = getManifestPath(projectRoot);
  if (!(await fs.pathExists(manifestPath))) {
    return createDefaultManifest() as NymorManifest;
  }

  const manifest = await fs.readJson(manifestPath);
  return normalizeManifest(manifest);
}

export async function writeManifest(projectRoot: string, manifest: NymorManifest): Promise<void> {
  const manifestPath = getManifestPath(projectRoot);
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

function normalizeManifest(raw: Partial<NymorManifest>): NymorManifest {
  const defaultManifest = createDefaultManifest();
  const agents = (raw.agents ?? defaultManifest.agents).filter((agent): agent is AgentTarget =>
    isAgentTarget(String(agent))
  );

  return {
    version: raw.version ?? defaultManifest.version,
    agents,
    local: raw.local ?? []
  };
}
