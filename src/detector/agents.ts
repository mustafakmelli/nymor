import path from "path";
import fs from "fs-extra";

export interface AgentPresence {
  claude: boolean;
  cursor: boolean;
  copilot: boolean;
  kiro: boolean;
  agentsMd: boolean;
}

export async function detectAgents(projectRoot: string): Promise<AgentPresence> {
  const [claudeDir, claudeMd, cursor, copilotFile, copilotDir, kiro, agentsMd] = await Promise.all([
    fs.pathExists(path.join(projectRoot, ".claude")),
    fs.pathExists(path.join(projectRoot, "CLAUDE.md")),
    fs.pathExists(path.join(projectRoot, ".cursor")),
    fs.pathExists(path.join(projectRoot, ".github", "copilot-instructions.md")),
    fs.pathExists(path.join(projectRoot, ".github", "instructions")),
    fs.pathExists(path.join(projectRoot, ".kiro")),
    fs.pathExists(path.join(projectRoot, "AGENTS.md"))
  ]);

  return {
    claude: claudeDir || claudeMd,
    cursor,
    copilot: copilotFile || copilotDir,
    kiro,
    agentsMd
  };
}
