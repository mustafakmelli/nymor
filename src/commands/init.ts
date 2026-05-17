import fs from "fs-extra";
import inquirer from "inquirer";
import { AGENT_TARGETS, AgentTarget, DEFAULT_AGENT_TARGETS } from "../agents/targets";
import { compileCommand } from "./compile";
import { detectAgents } from "../detector/agents";
import { createDefaultManifest } from "../templates/nymor-json";
import { NymorManifest, readManifest, writeManifest } from "../utils/manifest";
import { getManifestPath, getNymorDir, getSkillsDir } from "../utils/paths";

type InitMode = "new" | "update" | "reinit";

const AGENT_CHOICES: Array<{ name: string; value: AgentTarget; short: string }> = AGENT_TARGETS.map((target) => ({
  name: `${target.label} (${target.description})`,
  value: target.id,
  short: target.short
}));

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const nymorDir = getNymorDir(projectRoot);
  const skillsDir = getSkillsDir(projectRoot);

  const mode = await resolveInitMode(nymorDir);
  if (!mode) {
    return;
  }

  if (mode === "reinit") {
    await fs.remove(nymorDir);
  }

  const manifestPath = getManifestPath(projectRoot);
  const existingManifest = (await fs.pathExists(manifestPath)) ? await readManifest(projectRoot) : null;
  const manifest = createDefaultManifest() as NymorManifest;
  manifest.agents = await selectAgentTargets(projectRoot, existingManifest?.agents);
  manifest.local = mode === "reinit" ? [] : existingManifest?.local ?? [];
  await writeManifest(projectRoot, manifest);

  await fs.ensureDir(skillsDir);
  await compileCommand();
  printSummary(manifest.agents);
}

async function resolveInitMode(nymorDir: string): Promise<InitMode | null> {
  if (!(await fs.pathExists(nymorDir))) {
    return "new";
  }

  if (!process.stdin.isTTY) {
    return "update";
  }

  const { action } = await inquirer.prompt<{ action: InitMode | "cancel" }>([
    {
      type: "list",
      name: "action",
      message: "Nymor already initialized. What do you want to do?",
      choices: [
        { name: "Update agent targets", value: "update" },
        { name: "Reinitialize (overwrites .nymor/)", value: "reinit" },
        { name: "Cancel", value: "cancel" }
      ]
    }
  ]);

  return action === "cancel" ? null : action;
}

async function selectAgentTargets(projectRoot: string, existingAgents?: AgentTarget[]): Promise<AgentTarget[]> {
  const detectedAgents = await detectExistingAgentTargets(projectRoot);
  const defaults = existingAgents && existingAgents.length > 0 ? existingAgents : detectedAgents;

  if (!process.stdin.isTTY) {
    return defaults.length > 0 ? defaults : [...DEFAULT_AGENT_TARGETS];
  }

  const { agents } = await inquirer.prompt<{ agents: AgentTarget[] }>([
    {
      type: "checkbox",
      name: "agents",
      message: "Which agent outputs should Nymor manage?",
      choices: AGENT_CHOICES,
      default: defaults.length > 0 ? defaults : DEFAULT_AGENT_TARGETS
    }
  ]);

  return agents;
}

async function detectExistingAgentTargets(projectRoot: string): Promise<AgentTarget[]> {
  const detected = await detectAgents(projectRoot);
  return AGENT_TARGETS.filter((target) => detected[target.id]).map((target) => target.id);
}

function printSummary(agents: AgentTarget[]): void {
  const checkMark = "\u2713";

  console.log("");
  console.log(`${checkMark} Nymor initialized`);
  console.log("");
  console.log("Skills directory: .nymor/skills/");
  console.log("Index created:    .nymor/index.md");
  console.log(`Agent outputs:    ${formatAgentSummary(agents)}`);
}

function formatAgentSummary(agents: AgentTarget[]): string {
  if (agents.length === 0) {
    return "none selected";
  }

  const labels = new Map<AgentTarget, string>(AGENT_CHOICES.map((choice) => [choice.value, choice.short]));
  return agents.map((agent) => labels.get(agent) ?? agent).join(", ");
}
