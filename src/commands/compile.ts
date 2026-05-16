import fs from "fs-extra";
import path from "path";
import { compileClaudeSkills } from "../compiler/claude";
import { compileCopilotSkills } from "../compiler/copilot";
import { renderCopilotInstructions } from "../compiler/copilot";
import { compileCursorSkills } from "../compiler/cursor";
import { renderCursorRule } from "../compiler/cursor";
import { compileKiroSkills } from "../compiler/kiro";
import { renderKiroSteering } from "../compiler/kiro";
import { renderAgentsMarkdown } from "../compiler/agentsmd";
import { upsertManagedBlock } from "../compiler/block";
import { buildSkillIndex, loadSkills, SkillFile } from "../utils/skills";
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

export interface PlannedCompileFile {
  path: string;
  content: Buffer;
}

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

export async function planCompileOutputs(projectRoot: string): Promise<PlannedCompileFile[]> {
  const skillsDir = getSkillsDir(projectRoot);
  const skills = await loadSkills(skillsDir);
  const { markdown, json } = buildSkillIndex(skills);
  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);
  const files: PlannedCompileFile[] = [
    textFile(getIndexMarkdownPath(projectRoot), markdown),
    textFile(getIndexJsonPath(projectRoot), json)
  ];

  if (agentSet.has("claude")) {
    files.push(...(await planClaudeOutputs(skills, projectRoot)));
  }
  if (agentSet.has("cursor")) {
    for (const skill of skills) {
      files.push(textFile(path.join(projectRoot, ".cursor", "rules", `cicada-${skill.id}.mdc`), renderCursorRule(skill)));
    }
  }
  if (agentSet.has("copilot")) {
    for (const skill of skills) {
      files.push(
        textFile(
          path.join(projectRoot, ".github", "instructions", `cicada-${skill.id}.instructions.md`),
          renderCopilotInstructions(skill)
        )
      );
    }
  }
  if (agentSet.has("kiro")) {
    for (const skill of skills) {
      files.push(textFile(path.join(projectRoot, ".kiro", "steering", `cicada-${skill.id}.md`), renderKiroSteering(skill)));
    }
  }
  if (agentSet.has("agents-md")) {
    const agentsPath = path.join(projectRoot, "AGENTS.md");
    const existing = (await fs.pathExists(agentsPath)) ? await fs.readFile(agentsPath, "utf8") : null;
    files.push(textFile(agentsPath, upsertManagedBlock(existing, renderAgentsMarkdown(skills))));
  }

  files.push(...(await planBootstrapBlocks(projectRoot, agentSet)));
  return files;
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

async function planBootstrapBlocks(projectRoot: string, agents: Set<string>): Promise<PlannedCompileFile[]> {
  const templatesDir = await resolveTemplatesDir();
  const files: PlannedCompileFile[] = [];

  for (const target of BOOTSTRAP_TARGETS) {
    if (!agents.has(target.agent)) {
      continue;
    }

    const templatePath = path.join(templatesDir, target.template);
    const targetPath = path.join(projectRoot, target.file);
    const content = await fs.readFile(templatePath, "utf8");
    const existing = (await fs.pathExists(targetPath)) ? await fs.readFile(targetPath, "utf8") : null;
    files.push(textFile(targetPath, upsertManagedBlock(existing, content)));
  }

  return files;
}

async function planClaudeOutputs(skills: SkillFile[], projectRoot: string): Promise<PlannedCompileFile[]> {
  const files: PlannedCompileFile[] = [];

  for (const skill of skills) {
    const sourceFiles = await listFilesRecursive(skill.dirPath);
    for (const sourcePath of sourceFiles) {
      const relative = path.relative(skill.dirPath, sourcePath);
      files.push({
        path: path.join(projectRoot, ".claude", "skills", skill.id, relative),
        content: await fs.readFile(sourcePath)
      });
    }
  }

  return files;
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function textFile(filePath: string, content: string): PlannedCompileFile {
  return { path: filePath, content: Buffer.from(content, "utf8") };
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
