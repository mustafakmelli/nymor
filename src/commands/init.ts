import path from "path";
import fs from "fs-extra";
import inquirer from "inquirer";
import { compileCommand } from "./compile";
import { detectStack, Stack } from "../detector/stack";
import { createDefaultManifest } from "../templates/cicada-json";
import { CicadaManifest, writeManifest } from "../utils/manifest";
import { getCicadaDir, getManifestPath, getSkillsDir } from "../utils/paths";

type InitMode = "new" | "add" | "reinit";

const STACK_LABELS: Record<Stack, string> = {
  nodejs: "Node.js API",
  react: "React Frontend",
  fullstack: "Full Stack",
  python: "Python",
  generic: "Generic"
};

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
    await writeManifest(projectRoot, createDefaultManifest() as CicadaManifest);
  }

  await fs.ensureDir(skillsDir);
  const added = await copyStarterSkills(skillsDir, mode === "add");

  const detected = await detectStack(projectRoot);
  printDetectedStack(detected);

  await compileCommand();
  printSummary(added);
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

function printDetectedStack(stack: Stack): void {
  const checkMark = "\u2713";
  console.log(`${checkMark} Detected stack: ${STACK_LABELS[stack]}`);
}

function printSummary(added: string[]): void {
  const checkMark = "\u2713";
  const arrow = "\u2192";

  console.log("");
  console.log(`${checkMark} Cicada initialized`);
  console.log("");
  console.log(`Skills added:      ${added.length} skills ${arrow} .cicada/skills/`);
  console.log("Index created:     .cicada/index.md");
  console.log("Compiled outputs:  .claude/skills/, .cursor/rules/, .github/instructions/, .kiro/steering/");

  if (added.length > 0) {
    console.log("");
    console.log("Skills installed:");
    for (const name of added) {
      console.log(`  ${arrow} ${name}`);
    }
  }
}
