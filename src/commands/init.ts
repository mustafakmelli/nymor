import path from "path";
import fs from "fs-extra";
import inquirer from "inquirer";
import { compileCommand } from "./compile";
import { detectAgents } from "../detector/agents";
import { createDefaultManifest } from "../templates/cicada-json";
import { AgentTarget, CicadaManifest, readManifest, writeManifest } from "../utils/manifest";
import { getCicadaDir, getManifestPath, getSkillsDir } from "../utils/paths";

type InitMode = "new" | "add" | "reinit";

const AGENT_CHOICES: Array<{ name: string; value: AgentTarget; short: string }> = [
  { name: "Claude (.claude/skills + CLAUDE.md bootstrap)", value: "claude", short: "Claude" },
  { name: "Cursor (.cursor/rules)", value: "cursor", short: "Cursor" },
  { name: "GitHub Copilot (.github/instructions)", value: "copilot", short: "Copilot" },
  { name: "Kiro (.kiro/steering)", value: "kiro", short: "Kiro" },
  { name: "AGENTS.md", value: "agents-md", short: "AGENTS.md" }
];

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const cicadaDir = getCicadaDir(projectRoot);
  const skillsDir = getSkillsDir(projectRoot);

  let mode: InitMode = "new";
  if (await fs.pathExists(cicadaDir)) {
    const { action } = await inquirer.prompt<{ action: InitMode | "cancel" }>([
      {
        type: "list",
        name: "action",
        message: "Cicada already initialized. What do you want to do?",
        choices: [
          { name: "Add more skills", value: "add" },
          { name: "Reinitialize (overwrites everything)", value: "reinit" },
          { name: "Cancel", value: "cancel" }
        ]
      }
    ]);

    if (action === "cancel") {
      return;
    }

    mode = action;
    if (mode === "reinit") {
      await fs.remove(cicadaDir);
    }
  }

  const manifestPath = getManifestPath(projectRoot);
  if (mode !== "add" || !(await fs.pathExists(manifestPath))) {
    const manifest = createDefaultManifest() as CicadaManifest;
    manifest.agents = await selectAgentTargets(projectRoot);
    await writeManifest(projectRoot, manifest);
  }

  await fs.ensureDir(skillsDir);
  const added = await copyStarterSkills(skillsDir, mode === "add");
  await recordStarterSkills(projectRoot, added);

  await compileCommand();
  const manifest = await readManifest(projectRoot);
  printSummary(added, manifest.agents);
}

async function selectAgentTargets(projectRoot: string): Promise<AgentTarget[]> {
  const detectedAgents = await detectExistingAgentTargets(projectRoot);

  if (!process.stdin.isTTY) {
    return detectedAgents;
  }

  const { agents } = await inquirer.prompt<{ agents: AgentTarget[] }>([
    {
      type: "checkbox",
      name: "agents",
      message: "Which agent outputs should Cicada manage?",
      choices: AGENT_CHOICES,
      default: detectedAgents
    }
  ]);

  return agents;
}

async function detectExistingAgentTargets(projectRoot: string): Promise<AgentTarget[]> {
  const detected = await detectAgents(projectRoot);
  const agents: AgentTarget[] = [];

  if (detected.claude) {
    agents.push("claude");
  }
  if (detected.cursor) {
    agents.push("cursor");
  }
  if (detected.copilot) {
    agents.push("copilot");
  }
  if (detected.kiro) {
    agents.push("kiro");
  }
  if (detected.agentsMd) {
    agents.push("agents-md");
  }

  return agents;
}

async function recordStarterSkills(projectRoot: string, added: string[]): Promise<void> {
  if (added.length === 0) {
    return;
  }

  const manifest = await readManifest(projectRoot);
  for (const skill of added) {
    if (!manifest.local.includes(skill)) {
      manifest.local.push(skill);
    }
  }
  await writeManifest(projectRoot, manifest);
}

async function copyStarterSkills(destDir: string, skipExisting: boolean): Promise<string[]> {
  const sourceDir = await resolveStarterSkillsDir();
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const added: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(destDir, entry.name);
    if (skipExisting && (await fs.pathExists(targetPath))) {
      continue;
    }

    await fs.copy(sourcePath, targetPath, { overwrite: !skipExisting });
    added.push(entry.name);
  }

  return added;
}

async function resolveStarterSkillsDir(): Promise<string> {
  return resolveAssetDir([
    path.resolve(__dirname, "..", "skills"),
    path.resolve(__dirname, "..", "..", "src", "skills")
  ]);
}

async function resolveAssetDir(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate starter skills. Ensure skills assets are available.");
}

function printSummary(added: string[], agents: AgentTarget[]): void {
  const checkMark = "\u2713";
  const arrow = "\u2192";

  console.log("");
  console.log(`${checkMark} Cicada initialized`);
  console.log("");
  console.log(`Skills added:      ${added.length} skills ${arrow} .cicada/skills/`);
  console.log("Index created:     .cicada/index.md");
  console.log(`Compiled outputs:  ${formatAgentSummary(agents)}`);

  if (added.length > 0) {
    console.log("");
    console.log("Skills installed:");
    for (const name of added) {
      console.log(`  ${arrow} ${name}`);
    }
  }
}

function formatAgentSummary(agents: AgentTarget[]): string {
  if (agents.length === 0) {
    return "none selected";
  }

  const labels = new Map<AgentTarget, string>(AGENT_CHOICES.map((choice) => [choice.value, choice.short]));
  return agents.map((agent) => labels.get(agent) ?? agent).join(", ");
}
