import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { minimatch } from "minimatch";
import { AGENT_TARGETS, AgentTargetDefinition } from "../agents/targets";
import { renderCopilotInstructions } from "../compiler/copilot";
import { renderCursorRule } from "../compiler/cursor";
import { renderKiroSteering } from "../compiler/kiro";
import { upsertManagedBlock } from "../compiler/block";
import { renderBootstrap, renderLearnCommand, renderLearnSkill } from "../templates/bootstrap";
import { buildSkillIndex, loadSkills, SkillFile } from "../utils/skills";
import { readManifest } from "../utils/manifest";
import { getIndexJsonPath, getIndexMarkdownPath, getNymorDir, getSkillsDir } from "../utils/paths";

export interface PlannedCompileFile {
  path: string;
  content: Buffer;
}

export function getGitModifiedFiles(projectRoot: string): string[] {
  try {
    const stdout = execSync("git status --porcelain", { cwd: projectRoot, encoding: "utf8" });
    return stdout
      .split("\n")
      .map((line) => {
        if (line.length < 4) return "";
        return line.slice(3).trim().replace(/^"|"$/g, "");
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function filterSkills(skills: SkillFile[], focusFiles: string[]): SkillFile[] {
  if (focusFiles.length === 0) {
    return skills;
  }
  return skills.filter((skill) => {
    if (skill.frontmatter.alwaysApply) {
      return true;
    }
    const globs = skill.frontmatter.globs ?? [];
    if (globs.length === 0) {
      return false;
    }
    return focusFiles.some((file) =>
      globs.some((globPattern) => minimatch(file, globPattern, { dot: true, matchBase: true }))
    );
  });
}

export async function compileCommand(options: { focus?: string[]; git?: boolean } = {}): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log("No skills found. Run `nymor sync` first.");
    process.exitCode = 1;
    return;
  }

  const allSkills = await loadSkills(skillsDir);
  const { markdown, json } = buildSkillIndex(allSkills);

  await fs.ensureDir(getNymorDir(projectRoot));
  await fs.writeFile(getIndexMarkdownPath(projectRoot), markdown, "utf8");
  await fs.writeFile(getIndexJsonPath(projectRoot), json, "utf8");

  let focusFiles: string[] = [];
  if (options.focus) {
    focusFiles.push(...options.focus);
  }
  if (options.git) {
    focusFiles.push(...getGitModifiedFiles(projectRoot));
  }

  const activeSkills = filterSkills(allSkills, focusFiles);

  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);

  for (const target of AGENT_TARGETS) {
    if (agentSet.has(target.id)) {
      await writeTargetOutputs(projectRoot, target, activeSkills);
    }
  }
}

export async function planCompileOutputs(
  projectRoot: string,
  options: { focus?: string[]; git?: boolean } = {}
): Promise<PlannedCompileFile[]> {
  const skillsDir = getSkillsDir(projectRoot);
  const allSkills = await loadSkills(skillsDir);
  const { markdown, json } = buildSkillIndex(allSkills);
  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);
  const files: PlannedCompileFile[] = [
    textFile(getIndexMarkdownPath(projectRoot), markdown),
    textFile(getIndexJsonPath(projectRoot), json)
  ];

  let focusFiles: string[] = [];
  if (options.focus) {
    focusFiles.push(...options.focus);
  }
  if (options.git) {
    focusFiles.push(...getGitModifiedFiles(projectRoot));
  }

  const activeSkills = filterSkills(allSkills, focusFiles);

  for (const target of AGENT_TARGETS) {
    if (agentSet.has(target.id)) {
      files.push(...(await planTargetOutputs(projectRoot, target, activeSkills)));
    }
  }

  return files;
}

export async function writeTargetOutputs(projectRoot: string, target: AgentTargetDefinition, skills: SkillFile[]): Promise<void> {
  for (const file of await planTargetOutputs(projectRoot, target, skills)) {
    await fs.ensureDir(path.dirname(file.path));
    await fs.writeFile(file.path, file.content);
  }
}

async function planTargetOutputs(
  projectRoot: string,
  target: AgentTargetDefinition,
  skills: SkillFile[]
): Promise<PlannedCompileFile[]> {
  const files: PlannedCompileFile[] = [];

  if (target.bootstrapFile) {
    files.push(await planBootstrap(projectRoot, target, skills));
  }

  if (target.commandFile) {
    files.push(textFile(path.join(projectRoot, target.commandFile), `${renderLearnCommand(target)}\n`));
  }

  switch (target.kind) {
    case "claude":
      files.push(...(await planClaudeOutputs(skills, projectRoot)));
      break;
    case "cursor":
      for (const skill of skills) {
        files.push(textFile(path.join(projectRoot, ".cursor", "rules", `nymor-${skill.id}.mdc`), renderCursorRule(skill)));
      }
      break;
    case "copilot":
      for (const skill of skills) {
        files.push(
          textFile(
            path.join(projectRoot, ".github", "instructions", `nymor-${skill.id}.instructions.md`),
            renderCopilotInstructions(skill)
          )
        );
      }
      break;
    case "kiro":
      for (const skill of skills) {
        files.push(textFile(path.join(projectRoot, ".kiro", "steering", `nymor-${skill.id}.md`), renderKiroSteering(skill)));
      }
      break;
    case "native-skills":
      if (target.nativeSkillDir) {
        files.push(...(await planNativeSkillOutputs(projectRoot, target, skills)));
      }
      break;
    case "shared-md":
    case "gemini":
    case "windsurf":
      break;
  }

  return files;
}

async function planBootstrap(
  projectRoot: string,
  target: AgentTargetDefinition,
  skills: SkillFile[]
): Promise<PlannedCompileFile> {
  const targetPath = path.join(projectRoot, target.bootstrapFile!);
  const content = renderBootstrap(target, skills);

  if (target.id === "claude" || target.id === "agents-md" || target.id === "gemini") {
    const existing = (await fs.pathExists(targetPath)) ? await fs.readFile(targetPath, "utf8") : null;
    return textFile(targetPath, upsertManagedBlock(existing, content));
  }

  return textFile(targetPath, `${content.trimEnd()}\n`);
}

async function planClaudeOutputs(skills: SkillFile[], projectRoot: string): Promise<PlannedCompileFile[]> {
  const outputRoot = path.join(projectRoot, ".claude", "skills");
  const files: PlannedCompileFile[] = [];

  for (const skill of skills) {
    const sourceFiles = await listFilesRecursive(skill.dirPath);
    for (const sourcePath of sourceFiles) {
      const relative = path.relative(skill.dirPath, sourcePath);
      files.push({
        path: path.join(outputRoot, skill.id, relative),
        content: await fs.readFile(sourcePath)
      });
    }
  }

  return files;
}

async function planNativeSkillOutputs(
  projectRoot: string,
  target: AgentTargetDefinition,
  skills: SkillFile[]
): Promise<PlannedCompileFile[]> {
  const files: PlannedCompileFile[] = [
    textFile(path.join(projectRoot, target.nativeSkillDir!, "nymor-learn", "SKILL.md"), `${renderLearnSkill(target)}\n`)
  ];

  for (const skill of skills) {
    const sourceFiles = await listFilesRecursive(skill.dirPath);
    for (const sourcePath of sourceFiles) {
      const relative = path.relative(skill.dirPath, sourcePath);
      files.push({
        path: path.join(projectRoot, target.nativeSkillDir!, skill.id, relative),
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
