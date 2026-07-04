import path from "path";
import fs from "fs-extra";
import inquirer from "inquirer";
import type { DistinctQuestion } from "inquirer";
import yaml from "yaml";
import pc from "picocolors";
import { compileAndWrite } from "./sync";
import { readManifest, writeManifest } from "../utils/manifest";
import { getSkillsDir } from "../utils/paths";

interface LearnAnswers {
  name: string;
  description: string;
  globs: string;
  alwaysApply: boolean;
  why: string;
  example: string;
}

export interface LearnOptions {
  id?: string;
  name?: string;
  description?: string;
  globs?: string;
  alwaysApply?: boolean;
  why?: string;
  example?: string;
}

export async function learnCommand(rule: string, options: LearnOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const slug = slugifyRule(options.id ?? rule);
  const skillDir = path.join(getSkillsDir(projectRoot), slug);
  const skillPath = path.join(skillDir, "SKILL.md");

  if (await fs.pathExists(skillPath)) {
    throw new Error(`A local skill already exists at ${skillPath}`);
  }

  const answers = await promptForSkill(rule, slug, options);

  const frontmatter = yaml.stringify({
    name: answers.name,
    description: answers.description,
    globs: parseGlobs(answers.globs),
    alwaysApply: answers.alwaysApply
  });
  const content = [
    "---",
    frontmatter.trimEnd(),
    "---",
    "",
    `# Skill: ${answers.name}`,
    "",
    "## Rule",
    rule,
    "",
    "## Why",
    answers.why,
    "",
    "## Example",
    answers.example,
    ""
  ].join("\n");

  await fs.ensureDir(skillDir);
  await fs.writeFile(skillPath, content, "utf8");

  const manifest = await readManifest(projectRoot);
  if (!manifest.local.includes(slug)) {
    manifest.local.push(slug);
  }
  await writeManifest(projectRoot, manifest);

  await compileAndWrite(projectRoot);

  console.log("");
  console.log(`${pc.green("✓")} Created local skill: ${skillPath}`);
}

export function slugifyRule(rule: string): string {
  const slug = rule
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");

  return slug || "new-skill";
}

function parseGlobs(value: string): string[] {
  return value
    .split(",")
    .map((glob) => glob.trim())
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

async function promptForSkill(rule: string, slug: string, options: LearnOptions): Promise<LearnAnswers> {
  const defaults: LearnAnswers = {
    name: options.name ?? titleCase(slug),
    description: options.description ?? rule,
    globs: options.globs ?? "**/*",
    alwaysApply: options.alwaysApply ?? false,
    why: options.why ?? "TBD - describe why",
    example: options.example ?? "TBD - add an example"
  };

  if (!process.stdin.isTTY) {
    return defaults;
  }

  const questions: Array<DistinctQuestion<Partial<LearnAnswers>>> = [];

  if (options.name === undefined) {
    questions.push({
      type: "input",
      name: "name",
      message: "Skill name",
      default: defaults.name
    });
  }
  if (options.description === undefined) {
    questions.push({
      type: "input",
      name: "description",
      message: "Description",
      default: defaults.description
    });
  }
  if (options.globs === undefined) {
    questions.push({
      type: "input",
      name: "globs",
      message: "Globs",
      default: defaults.globs
    });
  }
  if (options.alwaysApply === undefined) {
    questions.push({
      type: "confirm",
      name: "alwaysApply",
      message: "Always apply?",
      default: defaults.alwaysApply
    });
  }
  if (options.why === undefined) {
    questions.push({
      type: "input",
      name: "why",
      message: "Why",
      default: defaults.why
    });
  }
  if (options.example === undefined) {
    questions.push({
      type: "input",
      name: "example",
      message: "Example",
      default: defaults.example
    });
  }

  const answers = questions.length > 0 ? await inquirer.prompt<Partial<LearnAnswers>>(questions) : {};
  return { ...defaults, ...answers };
}
