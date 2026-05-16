import path from "path";
import fs from "fs-extra";
import inquirer from "inquirer";
import yaml from "yaml";
import pc from "picocolors";
import { compileCommand } from "./compile";
import { readManifest, writeManifest } from "../utils/manifest";
import { getSkillsDir } from "../utils/paths";

interface LearnAnswers {
  name: string;
  description: string;
  globs: string;
  alwaysApply: boolean;
}

export async function learnCommand(rule: string): Promise<void> {
  const projectRoot = process.cwd();
  const slug = slugifyRule(rule);
  const skillDir = path.join(getSkillsDir(projectRoot), slug);
  const skillPath = path.join(skillDir, "SKILL.md");

  if (await fs.pathExists(skillPath)) {
    throw new Error(`A local skill already exists at ${skillPath}`);
  }

  const answers = await promptForSkill(rule, slug);

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
    "TBD - describe why",
    "",
    "## Example",
    "TBD - add an example",
    ""
  ].join("\n");

  await fs.ensureDir(skillDir);
  await fs.writeFile(skillPath, content, "utf8");

  const manifest = await readManifest(projectRoot);
  if (!manifest.local.includes(slug)) {
    manifest.local.push(slug);
  }
  await writeManifest(projectRoot, manifest);

  await compileCommand();

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

async function promptForSkill(rule: string, slug: string): Promise<LearnAnswers> {
  const defaults: LearnAnswers = {
    name: titleCase(slug),
    description: rule,
    globs: "**/*",
    alwaysApply: false
  };

  if (!process.stdin.isTTY) {
    return defaults;
  }

  return inquirer.prompt<LearnAnswers>([
    {
      type: "input",
      name: "name",
      message: "Skill name",
      default: defaults.name
    },
    {
      type: "input",
      name: "description",
      message: "Description",
      default: defaults.description
    },
    {
      type: "input",
      name: "globs",
      message: "Globs",
      default: defaults.globs
    },
    {
      type: "confirm",
      name: "alwaysApply",
      message: "Always apply?",
      default: defaults.alwaysApply
    }
  ]);
}
