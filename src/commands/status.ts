import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import { AGENT_TARGETS } from "../agents/targets";
import { planCompileOutputs } from "./compile";
import { readManifest } from "../utils/manifest";
import { getNymorDir, getSkillsDir } from "../utils/paths";
import { loadSkills } from "../utils/skills";

export async function statusCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const nymorDir = getNymorDir(projectRoot);
  const skillsDir = getSkillsDir(projectRoot);

  console.log("");

  // Check if nymor is initialized
  if (!(await fs.pathExists(nymorDir))) {
    console.log(pc.yellow("  Nymor is not initialized in this directory."));
    console.log(pc.dim('  Run "npx nymor sync" to get started.'));
    console.log("");
    return;
  }

  const manifest = await readManifest(projectRoot);
  const skills = await loadSkills(skillsDir);

  const alwaysApplySkills = skills.filter((s) => s.frontmatter.alwaysApply);
  const globScopedSkills = skills.filter((s) => !s.frontmatter.alwaysApply);
  const enabledTargets = AGENT_TARGETS.filter((t) => manifest.agents.includes(t.id));

  // Header
  console.log(`  ${pc.bold("Skills")}     ${skills.length} active  ${pc.dim(`(${alwaysApplySkills.length} always-apply, ${globScopedSkills.length} glob-scoped)`)}`);
  console.log(`  ${pc.bold("Agents")}     ${enabledTargets.map((t) => t.short).join(", ") || pc.dim("none selected")}`);

  // Staleness check
  let staleCount = 0;
  try {
    const planned = await planCompileOutputs(projectRoot);
    for (const file of planned) {
      if (!(await fs.pathExists(file.path))) {
        staleCount++;
        continue;
      }
      const actual = await fs.readFile(file.path);
      if (!actual.equals(file.content)) staleCount++;
    }
  } catch {
    staleCount = -1;
  }

  if (staleCount === -1) {
    console.log(`  ${pc.bold("State")}      ${pc.yellow("⚠  Could not check (run nymor sync)")}`);
  } else if (staleCount === 0) {
    console.log(`  ${pc.bold("State")}      ${pc.green("✓  All outputs up to date")}`);
  } else {
    console.log(`  ${pc.bold("State")}      ${pc.yellow(`⚠  ${staleCount} output${staleCount === 1 ? "" : "s"} are stale — run "nymor sync"`)}`);
  }

  // Skills detail
  if (skills.length > 0) {
    console.log("");
    console.log(`  ${pc.dim("─────────────────────────────────────────────────────")}`);

    for (const skill of skills) {
      const scope = skill.frontmatter.alwaysApply
        ? pc.cyan("always")
        : skill.frontmatter.globs && skill.frontmatter.globs.length > 0
          ? pc.dim(skill.frontmatter.globs.slice(0, 2).join(", ") + (skill.frontmatter.globs.length > 2 ? ` +${skill.frontmatter.globs.length - 2}` : ""))
          : pc.dim("no scope");

      console.log(`  ${pc.green("●")}  ${skill.frontmatter.name.padEnd(28)} ${scope}`);
    }
  }

  console.log("");
}
