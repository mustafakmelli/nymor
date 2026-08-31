import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import { AGENT_TARGETS, AgentTargetDefinition } from "../agents/targets";
import { planCompileOutputs } from "./compile";
import { readManifest } from "../utils/manifest";
import { getNymorDir } from "../utils/paths";

export interface CleanOptions {
  dryRun?: boolean;
}

interface OrphanedFile {
  /** Absolute path to the orphaned file */
  path: string;
  /** Human-readable agent label (e.g. "Cursor") */
  agent: string;
}

/**
 * nymor clean — Remove orphaned compiled outputs.
 *
 * When you delete or rename a skill, the old compiled files (.mdc, .instructions.md, etc.)
 * are left behind in agent directories. This command finds and removes them.
 */
export async function cleanCommand(options: CleanOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const nymorDir = getNymorDir(projectRoot);

  console.log("");

  if (!(await fs.pathExists(nymorDir))) {
    console.log(pc.yellow("  Nymor is not initialized in this directory."));
    console.log(pc.dim('  Run "npx nymor sync" to get started.'));
    console.log("");
    return;
  }

  const orphans = await findOrphanedOutputs(projectRoot);

  if (orphans.length === 0) {
    console.log(`  ${pc.green("✓")}  No orphaned files found. Everything is clean.`);
    console.log("");
    return;
  }

  if (options.dryRun) {
    console.log(`  ${pc.cyan("Dry run")} — the following ${orphans.length} file${orphans.length === 1 ? "" : "s"} would be removed:\n`);
    for (const orphan of orphans) {
      const rel = path.relative(projectRoot, orphan.path);
      console.log(`  ${pc.red("✗")}  ${rel}  ${pc.dim(`(${orphan.agent})`)}`);
    }
    console.log("");
    return;
  }

  // Actually delete
  let deleted = 0;
  const errors: string[] = [];

  for (const orphan of orphans) {
    try {
      await fs.remove(orphan.path);
      deleted++;
      const rel = path.relative(projectRoot, orphan.path);
      console.log(`  ${pc.red("✗")}  Removed ${rel}  ${pc.dim(`(${orphan.agent})`)}`);
    } catch (err) {
      errors.push(`${path.relative(projectRoot, orphan.path)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Clean up empty directories left behind
  await cleanEmptyDirs(projectRoot);

  console.log("");
  if (deleted > 0) {
    console.log(`  ${pc.green("✓")}  Removed ${deleted} orphaned file${deleted === 1 ? "" : "s"}.`);
  }
  if (errors.length > 0) {
    console.log(`  ${pc.red("✗")}  ${errors.length} error${errors.length === 1 ? "" : "s"} during cleanup:`);
    for (const err of errors) {
      console.log(`     ${pc.dim(err)}`);
    }
    process.exitCode = 1;
  }
  console.log("");
}

/**
 * Find files in agent output directories that are nymor-managed but don't
 * correspond to any planned compile output (i.e. the skill was deleted).
 */
async function findOrphanedOutputs(projectRoot: string): Promise<OrphanedFile[]> {
  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);

  // Get the set of files that *should* exist
  const planned = await planCompileOutputs(projectRoot);
  const plannedPaths = new Set(planned.map((f) => f.path));

  const orphans: OrphanedFile[] = [];

  for (const target of AGENT_TARGETS) {
    if (!agentSet.has(target.id)) continue;

    const existing = await findNymorManagedFiles(projectRoot, target);
    for (const filePath of existing) {
      if (!plannedPaths.has(filePath)) {
        orphans.push({ path: filePath, agent: target.label });
      }
    }
  }

  return orphans.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Scan an agent target's output directories for nymor-managed files.
 * These are files with nymor-specific naming patterns that we generated.
 */
async function findNymorManagedFiles(projectRoot: string, target: AgentTargetDefinition): Promise<string[]> {
  const files: string[] = [];

  switch (target.kind) {
    case "cursor": {
      // .cursor/rules/nymor-*.mdc
      const dir = path.join(projectRoot, ".cursor", "rules");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor-") && name.endsWith(".mdc"))));
      break;
    }

    case "copilot": {
      // .github/instructions/nymor-*.instructions.md
      const dir = path.join(projectRoot, ".github", "instructions");
      files.push(
        ...(await findMatchingFiles(dir, (name) => name.startsWith("nymor-") && name.endsWith(".instructions.md")))
      );
      break;
    }

    case "kiro": {
      // .kiro/steering/nymor-*.md
      const dir = path.join(projectRoot, ".kiro", "steering");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor-") && name.endsWith(".md"))));
      break;
    }

    case "claude": {
      // .claude/skills/<id>/ — each subdirectory is a skill
      const dir = path.join(projectRoot, ".claude", "skills");
      files.push(...(await findAllFilesRecursive(dir)));
      break;
    }

    case "native-skills": {
      // .goose/skills/<id>/ or .opencode/skill/<id>/ — each subdirectory is a skill
      if (target.nativeSkillDir) {
        const dir = path.join(projectRoot, target.nativeSkillDir);
        files.push(...(await findAllFilesRecursive(dir)));
      }
      break;
    }

    case "cline": {
      const dir = path.join(projectRoot, ".cline", "rules");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    case "cody": {
      const dir = path.join(projectRoot, ".cody", "instructions");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    case "tabnine": {
      const dir = path.join(projectRoot, ".tabnine", "instructions");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    case "codewhisperer": {
      // Single bootstrap file — only clean if it shouldn't exist
      if (target.bootstrapFile) {
        const fp = path.join(projectRoot, target.bootstrapFile);
        if (await fs.pathExists(fp)) files.push(fp);
      }
      break;
    }

    case "jetbrains": {
      const dir = path.join(projectRoot, ".idea", "ai-assistant");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    case "replit": {
      const dir = path.join(projectRoot, ".replit", "ai-instructions");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    case "zed": {
      const dir = path.join(projectRoot, ".zed", "ai-rules");
      files.push(...(await findMatchingFiles(dir, (name) => name.startsWith("nymor") && name.endsWith(".md"))));
      break;
    }

    // shared-md, gemini, windsurf use managed blocks or single bootstrap files —
    // these are handled via upsertManagedBlock and shouldn't be deleted wholesale
    case "shared-md":
    case "gemini":
    case "windsurf":
      break;
  }

  // Also include command files (e.g. .cursor/commands/nymor-learn.md)
  if (target.commandFile) {
    const cmdPath = path.join(projectRoot, target.commandFile);
    if (await fs.pathExists(cmdPath)) {
      files.push(cmdPath);
    }
  }

  return files;
}

/**
 * Find files in a directory matching a predicate on the filename.
 */
async function findMatchingFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && predicate(e.name))
    .map((e) => path.join(dir, e.name));
}

/**
 * Recursively find all files under a directory.
 */
async function findAllFilesRecursive(dir: string): Promise<string[]> {
  if (!(await fs.pathExists(dir))) return [];

  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findAllFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Remove empty directories left behind after file deletion.
 * Walks the known agent output directories and removes any that are empty.
 */
async function cleanEmptyDirs(projectRoot: string): Promise<void> {
  const dirsToCheck = [
    path.join(projectRoot, ".claude", "skills"),
    path.join(projectRoot, ".cursor", "rules"),
    path.join(projectRoot, ".cursor", "commands"),
    path.join(projectRoot, ".github", "instructions"),
    path.join(projectRoot, ".github", "prompts"),
    path.join(projectRoot, ".kiro", "steering"),
    path.join(projectRoot, ".goose", "skills"),
    path.join(projectRoot, ".opencode", "skill"),
    path.join(projectRoot, ".cline", "rules"),
    path.join(projectRoot, ".cody", "instructions"),
    path.join(projectRoot, ".tabnine", "instructions"),
    path.join(projectRoot, ".idea", "ai-assistant"),
    path.join(projectRoot, ".replit", "ai-instructions"),
    path.join(projectRoot, ".zed", "ai-rules"),
  ];

  for (const dir of dirsToCheck) {
    await removeEmptyDirsRecursive(dir);
  }
}

/**
 * Recursively remove empty directories from the bottom up.
 */
async function removeEmptyDirsRecursive(dir: string): Promise<void> {
  if (!(await fs.pathExists(dir))) return;

  const entries = await fs.readdir(dir, { withFileTypes: true });

  // First, recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirsRecursive(path.join(dir, entry.name));
    }
  }

  // Re-check after potential subdirectory removal
  const remaining = await fs.readdir(dir);
  if (remaining.length === 0) {
    await fs.rmdir(dir);
  }
}
