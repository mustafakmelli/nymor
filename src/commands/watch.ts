import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import { getNymorDir, getSkillsDir } from "../utils/paths";
import { compileAndWrite } from "./sync";

export async function watchCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const nymorDir = getNymorDir(projectRoot);
  const skillsDir = getSkillsDir(projectRoot);

  if (!(await fs.pathExists(nymorDir))) {
    console.error(pc.red('✗ Nymor not initialized. Run "nymor sync" first.'));
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`  ${pc.cyan("Watching")} ${pc.dim(".nymor/skills/")} for changes...`);
  console.log(`  ${pc.dim("Press Ctrl+C to stop.")}`);
  console.log("");

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isCompiling = false;

  const triggerSync = (changedFile: string): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (isCompiling) return;
      isCompiling = true;
      const timestamp = new Date().toLocaleTimeString();
      const rel = path.relative(projectRoot, changedFile);
      console.log(`  ${pc.dim(`[${timestamp}]`)} Change detected: ${pc.yellow(rel)}`);
      try {
        const { skillCount } = await compileAndWrite(projectRoot);
        console.log(`  ${pc.dim(`[${timestamp}]`)} ${pc.green("✓")} Synced ${skillCount} skill${skillCount === 1 ? "" : "s"}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ${pc.dim(`[${timestamp}]`)} ${pc.red("✗")} Sync failed: ${msg}`);
      } finally {
        isCompiling = false;
      }
    }, 300);
  };

  // Watch skills directory recursively
  if (await fs.pathExists(skillsDir)) {
    fs.watch(skillsDir, { recursive: true }, (_event, filename) => {
      if (filename) {
        triggerSync(path.join(skillsDir, filename));
      }
    });
  }

  // Watch nymor.json for agent config changes
  const manifestPath = path.join(projectRoot, "nymor.json");
  if (await fs.pathExists(manifestPath)) {
    fs.watch(manifestPath, () => {
      triggerSync(manifestPath);
    });
  }

  // Run an initial sync on start
  try {
    const { skillCount } = await compileAndWrite(projectRoot);
    const timestamp = new Date().toLocaleTimeString();
    console.log(`  ${pc.dim(`[${timestamp}]`)} ${pc.green("✓")} Initial sync: ${skillCount} skill${skillCount === 1 ? "" : "s"}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${pc.red("✗")} Initial sync failed: ${msg}`);
  }

  // Keep process alive
  await new Promise<void>(() => {});
}
