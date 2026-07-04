import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import yaml from "yaml";
import { AGENT_TARGETS, AgentTarget, DEFAULT_AGENT_TARGETS } from "../agents/targets";
import { detectAgents } from "../detector/agents";
import { createDefaultManifest } from "../templates/nymor-json";
import { NymorManifest, readManifest, writeManifest } from "../utils/manifest";
import { getNymorDir, getSkillsDir, getIndexMarkdownPath, getIndexJsonPath } from "../utils/paths";
import {
  planCompileOutputs,
  writeTargetOutputs,
  getGitModifiedFiles,
  filterSkills,
  PlannedCompileFile,
} from "./compile";
import { loadSkills, buildSkillIndex } from "../utils/skills";
import { slugifyRule } from "./learn";

export interface SyncOptions {
  dryRun?: boolean;
  agents?: string[];
  force?: boolean;
}

/**
 * Internal helper: compile all skills to planned output files and write them.
 * Used by sync, learn, and watch.
 */
export async function compileAndWrite(
  projectRoot: string,
  options: { focus?: string[]; git?: boolean } = {}
): Promise<{ skillCount: number; fileCount: number }> {
  const skillsDir = getSkillsDir(projectRoot);
  const allSkills = await loadSkills(skillsDir);
  const { markdown, json } = buildSkillIndex(allSkills);

  await fs.ensureDir(getNymorDir(projectRoot));
  await fs.writeFile(getIndexMarkdownPath(projectRoot), markdown, "utf8");
  await fs.writeFile(getIndexJsonPath(projectRoot), json, "utf8");

  let focusFiles: string[] = [];
  if (options.focus) focusFiles.push(...options.focus);
  if (options.git) focusFiles.push(...getGitModifiedFiles(projectRoot));

  const activeSkills = filterSkills(allSkills, focusFiles);
  const manifest = await readManifest(projectRoot);
  const agentSet = new Set(manifest.agents);
  let fileCount = 2; // index.md + index.json

  for (const target of AGENT_TARGETS) {
    if (agentSet.has(target.id)) {
      await writeTargetOutputs(projectRoot, target, activeSkills);
    }
  }

  // Count planned files
  const planned = await planCompileOutputs(projectRoot);
  fileCount = planned.length;

  return { skillCount: activeSkills.length, fileCount };
}

/**
 * nymor sync — The primary command.
 *
 * Auto-detects agents, auto-initializes on first run, auto-imports
 * existing rules, and compiles everything in one shot.
 */
export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const nymorDir = getNymorDir(projectRoot);
  const skillsDir = getSkillsDir(projectRoot);
  const isFirstRun = !(await fs.pathExists(nymorDir));

  console.log("");

  // ── Step 1: Detect or override agents ───────────────────────────────────
  let agents: AgentTarget[];

  if (options.agents && options.agents.length > 0) {
    agents = options.agents.filter((a): a is AgentTarget =>
      AGENT_TARGETS.some((t) => t.id === a)
    );
    if (agents.length === 0) {
      console.error(pc.red(`✗ No valid agent IDs provided. Valid options: ${AGENT_TARGETS.map((t) => t.id).join(", ")}`));
      process.exitCode = 1;
      return;
    }
  } else {
    const detected = await detectAgents(projectRoot);
    agents = AGENT_TARGETS.filter((t) => detected[t.id]).map((t) => t.id);
    if (agents.length === 0) {
      agents = [...DEFAULT_AGENT_TARGETS];
    }
  }

  const agentLabels = agents
    .map((id) => AGENT_TARGETS.find((t) => t.id === id)?.short ?? id)
    .join(", ");

  console.log(`  ${pc.dim("Agents:")}  ${agentLabels}`);

  // ── Step 2: Initialize on first run ─────────────────────────────────────
  if (isFirstRun || options.force) {
    await fs.ensureDir(skillsDir);
    const manifest = createDefaultManifest() as NymorManifest;
    manifest.agents = agents;
    manifest.local = [];
    await writeManifest(projectRoot, manifest);

    if (isFirstRun) {
      console.log(`  ${pc.dim("Init:")}    Created .nymor/`);
    }
  } else {
    // Update agent list in existing manifest
    const manifest = await readManifest(projectRoot);
    manifest.agents = agents;
    await writeManifest(projectRoot, manifest);
  }

  // ── Step 3: Auto-import existing rules (first run or --force) ───────────
  let importedCount = 0;
  if (isFirstRun || options.force) {
    importedCount = await autoImportExistingRules(projectRoot, skillsDir);
    if (importedCount > 0) {
      console.log(`  ${pc.dim("Import:")}  Imported ${importedCount} existing rule${importedCount === 1 ? "" : "s"}`);
    }
  }

  // ── Step 4: Compile ──────────────────────────────────────────────────────
  if (options.dryRun) {
    await runDryRun(projectRoot);
    return;
  }

  const { skillCount, fileCount } = await compileAndWrite(projectRoot);

  // ── Step 5: Summary ──────────────────────────────────────────────────────
  const manifest = await readManifest(projectRoot);
  const enabledTargets = AGENT_TARGETS.filter((t) => manifest.agents.includes(t.id));

  console.log(`  ${pc.dim("Skills:")}  ${skillCount} compiled → ${enabledTargets.length} agent surface${enabledTargets.length === 1 ? "" : "s"}`);
  console.log("");

  for (const target of enabledTargets) {
    const outputDesc = target.bootstrapFile
      ? path.dirname(target.bootstrapFile) || target.bootstrapFile
      : target.nativeSkillDir ?? "—";
    console.log(`  ${pc.green("✓")}  ${target.label.padEnd(22)} ${pc.dim(outputDesc)}`);
  }

  console.log("");

  if (skillCount === 0) {
    console.log(pc.dim('  No skills yet. Inside your AI agent, type /nymor-learn "your rule here"'));
  } else {
    console.log(pc.dim('  Run "nymor list" to see active skills, "nymor status" to check sync state.'));
  }

  console.log("");
}

async function runDryRun(projectRoot: string): Promise<void> {
  const planned = await planCompileOutputs(projectRoot);
  const changes: { path: string; status: "new" | "changed" | "unchanged" }[] = [];

  for (const file of planned) {
    if (!(await fs.pathExists(file.path))) {
      changes.push({ path: path.relative(projectRoot, file.path), status: "new" });
    } else {
      const actual = await fs.readFile(file.path);
      changes.push({
        path: path.relative(projectRoot, file.path),
        status: actual.equals(file.content) ? "unchanged" : "changed"
      });
    }
  }

  const newFiles = changes.filter((c) => c.status === "new");
  const changedFiles = changes.filter((c) => c.status === "changed");
  const unchangedFiles = changes.filter((c) => c.status === "unchanged");

  console.log(`  ${pc.cyan("Dry run")} — no files written\n`);
  for (const f of newFiles) console.log(`  ${pc.green("+ new")}      ${f.path}`);
  for (const f of changedFiles) console.log(`  ${pc.yellow("~ changed")}  ${f.path}`);
  console.log("");
  console.log(`  ${newFiles.length} new, ${changedFiles.length} changed, ${unchangedFiles.length} unchanged`);
  console.log("");
}

async function autoImportExistingRules(projectRoot: string, skillsDir: string): Promise<number> {
  let count = 0;

  // Flat-file imports: single markdown files → one skill each
  const flatImports: Array<{ file: string; slug: string; name: string; description: string }> = [
    {
      file: ".cursorrules",
      slug: "global-cursor-rules",
      name: "Global Cursor Rules",
      description: "Imported from .cursorrules"
    },
    {
      file: path.join(".github", "copilot-instructions.md"),
      slug: "copilot-instructions",
      name: "Copilot Instructions",
      description: "Imported from .github/copilot-instructions.md"
    },
    {
      file: "CLAUDE.md",
      slug: "claude-instructions",
      name: "Claude Instructions",
      description: "Imported from CLAUDE.md"
    },
    {
      file: "GEMINI.md",
      slug: "gemini-instructions",
      name: "Gemini Instructions",
      description: "Imported from GEMINI.md"
    },
    {
      file: ".windsurfrules",
      slug: "windsurf-rules",
      name: "Windsurf Rules",
      description: "Imported from .windsurfrules"
    },
    {
      file: "CLINE.md",
      slug: "cline-instructions",
      name: "Cline Instructions",
      description: "Imported from CLINE.md"
    },
    {
      file: "AGENTS.md",
      slug: "agents-instructions",
      name: "Agent Instructions",
      description: "Imported from AGENTS.md"
    }
  ];

  for (const entry of flatImports) {
    const filePath = path.join(projectRoot, entry.file);
    if (!(await fs.pathExists(filePath))) continue;

    const skillPath = path.join(skillsDir, entry.slug, "SKILL.md");
    if (await fs.pathExists(skillPath)) continue;

    // Skip files that are nymor-managed (contain nymor block marker)
    const raw = await fs.readFile(filePath, "utf8");
    if (raw.includes("<!-- nymor:start -->")) continue;

    await writeImportedSkill(skillPath, {
      name: entry.name,
      description: entry.description,
      globs: ["**/*"],
      alwaysApply: true,
      body: raw
    });
    await registerSkillInManifest(projectRoot, entry.slug);
    count++;
  }

  // Directory imports: .cursor/rules/*.mdc
  const cursorRulesDir = path.join(projectRoot, ".cursor", "rules");
  if (await fs.pathExists(cursorRulesDir)) {
    const entries = await fs.readdir(cursorRulesDir, { withFileTypes: true });
    const mdcFiles = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".mdc") && !e.name.startsWith("nymor-") && e.name !== "nymor.mdc"
    );
    for (const entry of mdcFiles) {
      const mdcPath = path.join(cursorRulesDir, entry.name);
      const raw = await fs.readFile(mdcPath, "utf8");
      try {
        const { frontmatter, body } = parseMdcContent(raw);
        const name = frontmatter.description || entry.name.replace(/\.mdc$/, "");
        const slug = slugifyRule(entry.name.replace(/\.mdc$/, ""));
        const skillPath = path.join(skillsDir, slug, "SKILL.md");
        if (!(await fs.pathExists(skillPath))) {
          await writeImportedSkill(skillPath, {
            name,
            description: frontmatter.description || `Imported from ${entry.name}`,
            globs: frontmatter.globs || ["**/*"],
            alwaysApply: frontmatter.alwaysApply ?? false,
            body
          });
          await registerSkillInManifest(projectRoot, slug);
          count++;
        }
      } catch {
        // Skip unparseable files silently
      }
    }
  }

  // Directory imports: .github/instructions/*.instructions.md (non-nymor)
  const copilotInstructionsDir = path.join(projectRoot, ".github", "instructions");
  if (await fs.pathExists(copilotInstructionsDir)) {
    const entries = await fs.readdir(copilotInstructionsDir, { withFileTypes: true });
    const mdFiles = entries.filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".instructions.md") &&
        !e.name.startsWith("nymor-") &&
        e.name !== "nymor-bootstrap.instructions.md"
    );
    for (const entry of mdFiles) {
      const mdPath = path.join(copilotInstructionsDir, entry.name);
      const raw = await fs.readFile(mdPath, "utf8");
      try {
        const { frontmatter, body } = parseMdcContent(raw);
        const baseName = entry.name.replace(/\.instructions\.md$/, "");
        const slug = slugifyRule(baseName);
        const skillPath = path.join(skillsDir, slug, "SKILL.md");
        if (!(await fs.pathExists(skillPath))) {
          const globs = frontmatter.applyTo && frontmatter.applyTo !== "**/*"
            ? String(frontmatter.applyTo).split(",").map((g: string) => g.trim())
            : ["**/*"];
          await writeImportedSkill(skillPath, {
            name: baseName,
            description: `Imported from .github/instructions/${entry.name}`,
            globs,
            alwaysApply: globs[0] === "**/*",
            body
          });
          await registerSkillInManifest(projectRoot, slug);
          count++;
        }
      } catch {
        // Skip unparseable files silently
      }
    }
  }

  return count;
}


async function writeImportedSkill(
  skillPath: string,
  data: { name: string; description: string; globs: string[]; alwaysApply: boolean; body: string }
): Promise<void> {
  const fm = yaml.stringify({
    name: data.name,
    description: data.description,
    globs: data.globs,
    alwaysApply: data.alwaysApply
  });

  const content = [
    "---",
    fm.trimEnd(),
    "---",
    "",
    `# Skill: ${data.name}`,
    "",
    "## Rule",
    data.body.trim(),
    "",
    "## Why",
    "Imported from existing rules.",
    "",
    "## Example",
    "TBD — add an example",
    ""
  ].join("\n");

  await fs.ensureDir(path.dirname(skillPath));
  await fs.writeFile(skillPath, content, "utf8");
}

async function registerSkillInManifest(projectRoot: string, slug: string): Promise<void> {
  const manifest = await readManifest(projectRoot);
  if (!manifest.local.includes(slug)) {
    manifest.local.push(slug);
    await writeManifest(projectRoot, manifest);
  }
}

function parseMdcContent(content: string): { frontmatter: Record<string, any>; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: {}, body: content };
  }
  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter = (yaml.parse(lines.slice(1, endIndex + 1).join("\n")) ?? {}) as Record<string, any>;
  const body = lines.slice(endIndex + 2).join("\n").trimStart();
  return { frontmatter, body };
}
