import fs from "fs-extra";
import path from "path";
import { compileClaudeSkills } from "../compiler/claude";
import { compileCopilotSkills } from "../compiler/copilot";
import { compileCursorSkills } from "../compiler/cursor";
import { compileKiroSkills } from "../compiler/kiro";
import { renderAgentsMarkdown } from "../compiler/agentsmd";
import { upsertManagedBlock } from "../compiler/block";
import { buildSkillIndex, loadSkills } from "../utils/skills";
import { readManifest } from "../utils/manifest";
import {
  getCicadaDir,
  getIndexJsonPath,
  getIndexMarkdownPath,
  getSkillsDir
} from "../utils/paths";

const BOOTSTRAP_TARGETS = [
  { agent: "claude", template: "claude.md", file: "CLAUDE.md" },
  { agent: "cursor", template: "cursor.md", file: path.join(".cursor", "rules", "cicada.mdc") },
  {
    agent: "copilot",
    template: "copilot.md",
    file: path.join(".github", "instructions", "cicada-bootstrap.instructions.md")
  },
  { agent: "kiro", template: "kiro.md", file: path.join(".kiro", "steering", "cicada.md") }
];

export async function compileCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log("No skills found. Run cicada init first.");
    process.exitCode = 1;
    return;
  }

  const skills = await loadSkills(skillsDir);
  const { markdown, json } = buildSkillIndex(skills);

  await fs.ensureDir(getCicadaDir(projectRoot));
  await fs.writeFile(getIndexMarkdownPath(projectRoot), markdown, "utf8");
  await fs.writeFile(getIndexJsonPath(projectRoot), json, "utf8");

  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);

  if (agentSet.has("claude")) {
    await compileClaudeSkills(skills, projectRoot);
  }
  if (agentSet.has("cursor")) {
    await compileCursorSkills(skills, projectRoot);
  }
  if (agentSet.has("copilot")) {
    await compileCopilotSkills(skills, projectRoot);
  }
  if (agentSet.has("kiro")) {
    await compileKiroSkills(skills, projectRoot);
  }
  if (agentSet.has("agents-md")) {
    await writeAgentsMarkdown(projectRoot, skills);
  }

  await writeBootstrapBlocks(projectRoot, agentSet);

  console.log(`Compiled ${skills.length} skills.`);
}

async function writeAgentsMarkdown(projectRoot: string, skills: Awaited<ReturnType<typeof loadSkills>>): Promise<void> {
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const content = renderAgentsMarkdown(skills);
  const existing = (await fs.pathExists(agentsPath)) ? await fs.readFile(agentsPath, "utf8") : null;
  const next = upsertManagedBlock(existing, content);
  await fs.writeFile(agentsPath, next, "utf8");
}

async function writeBootstrapBlocks(projectRoot: string, agents: Set<string>): Promise<void> {
  const templatesDir = await resolveTemplatesDir();

  for (const target of BOOTSTRAP_TARGETS) {
    if (!agents.has(target.agent)) {
      continue;
    }

    const templatePath = path.join(templatesDir, target.template);
    const targetPath = path.join(projectRoot, target.file);
    const content = await fs.readFile(templatePath, "utf8");
    const existing = (await fs.pathExists(targetPath)) ? await fs.readFile(targetPath, "utf8") : null;

    await fs.ensureDir(path.dirname(targetPath));
    const next = upsertManagedBlock(existing, content);
    await fs.writeFile(targetPath, next, "utf8");
  }
}

async function resolveTemplatesDir(): Promise<string> {
  return resolveAssetDir([
    path.resolve(__dirname, "..", "templates", "agent-bootstrap"),
    path.resolve(__dirname, "..", "..", "src", "templates", "agent-bootstrap")
  ]);
}

async function resolveAssetDir(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate Cicada templates. Ensure agent-bootstrap templates exist.");
}
