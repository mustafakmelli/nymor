import path from "path";
import fs from "fs-extra";
import { AGENT_TARGETS, AgentTarget } from "../agents/targets";

export type AgentPresence = Record<AgentTarget, boolean>;

export async function detectAgents(projectRoot: string): Promise<AgentPresence> {
  const entries = await Promise.all(
    AGENT_TARGETS.map(async (target) => {
      const detected = await hasAnyPath(projectRoot, target.detectPaths);
      return [target.id, detected] as const;
    })
  );

  return Object.fromEntries(entries) as AgentPresence;
}

async function hasAnyPath(projectRoot: string, relativePaths: string[]): Promise<boolean> {
  for (const relativePath of relativePaths) {
    if (await fs.pathExists(path.join(projectRoot, relativePath))) {
      return true;
    }
  }

  return false;
}
