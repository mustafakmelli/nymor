import fs from "fs-extra";
import path from "path";
import pc from "picocolors";
import { compileCommand } from "./compile";
import { createEmptyLockfile, parseRegistrySkill } from "./add";
import { readLockfile, readManifest, writeLockfile, writeManifest } from "../utils/manifest";
import { getSkillsDir } from "../utils/paths";

export async function removeCommand(skill: string): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseRegistrySkill(skill);
  const manifest = await readManifest(projectRoot);

  if (!manifest.skills[parsed.packageName]) {
    throw new Error(`Skill ${parsed.packageName} is not installed.`);
  }

  await fs.remove(path.join(getSkillsDir(projectRoot), parsed.folderName));
  await removeCompiledOutputs(projectRoot, parsed.folderName);

  delete manifest.skills[parsed.packageName];
  await writeManifest(projectRoot, manifest);

  const lockfile = (await readLockfile(projectRoot)) ?? createEmptyLockfile();
  delete lockfile.skills[parsed.packageName];
  await writeLockfile(projectRoot, lockfile);

  await compileCommand();

  console.log(`${pc.green("✓")} Removed ${parsed.packageName}`);
}

async function removeCompiledOutputs(projectRoot: string, folderName: string): Promise<void> {
  await Promise.all([
    fs.remove(path.join(projectRoot, ".claude", "skills", folderName)),
    fs.remove(path.join(projectRoot, ".cursor", "rules", `cicada-${folderName}.mdc`)),
    fs.remove(path.join(projectRoot, ".github", "instructions", `cicada-${folderName}.instructions.md`)),
    fs.remove(path.join(projectRoot, ".kiro", "steering", `cicada-${folderName}.md`))
  ]);
}
