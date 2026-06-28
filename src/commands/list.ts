import fs from "fs-extra";
import { minimatch } from "minimatch";
import { getIndexJsonPath, getSkillsDir } from "../utils/paths";
import { loadSkills, SkillIndexEntry } from "../utils/skills";
import { readManifest } from "../utils/manifest";
import { getGitModifiedFiles } from "./compile";

export interface ListCommandOptions {
  focus?: string[];
  git?: boolean;
}

export interface SkillUsageInsight {
  id: string;
  alwaysApply: boolean;
  matchedFiles: string[];
}

export function buildSkillUsageInsights(entries: SkillIndexEntry[], focusFiles: string[]): SkillUsageInsight[] {
  const normalizedFocusFiles = Array.from(
    new Set(focusFiles.map((file) => file.trim()).filter(Boolean))
  );

  return entries.map((entry) => {
    if (normalizedFocusFiles.length === 0) {
      return {
        id: entry.id,
        alwaysApply: entry.alwaysApply,
        matchedFiles: []
      };
    }

    if (entry.alwaysApply) {
      return {
        id: entry.id,
        alwaysApply: true,
        matchedFiles: [...normalizedFocusFiles]
      };
    }

    const globs = entry.globs ?? [];
    const matchedFiles = normalizedFocusFiles.filter((filePath) =>
      globs.some((globPattern) => minimatch(filePath, globPattern, { dot: true, matchBase: true }))
    );

    return {
      id: entry.id,
      alwaysApply: false,
      matchedFiles
    };
  });
}

export async function listCommand(options: ListCommandOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);
  const indexJsonPath = getIndexJsonPath(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log("No skills found. Run nymor init first.");
    return;
  }

  let entries: SkillIndexEntry[] = [];

  if (await fs.pathExists(indexJsonPath)) {
    const index = await fs.readJson(indexJsonPath);
    entries = Array.isArray(index.skills) ? index.skills : [];
  } else {
    const skills = await loadSkills(skillsDir);
    entries = skills.map((skill) => ({
      id: skill.id,
      name: skill.frontmatter.name,
      description: skill.frontmatter.description ?? "",
      globs: skill.frontmatter.globs ?? [],
      alwaysApply: Boolean(skill.frontmatter.alwaysApply)
    }));
  }

  console.log(`Nymor Skills (${entries.length})`);
  console.log("");

  if (entries.length === 0) {
    return;
  }

  const arrow = "\u2192";
  const manifest = await readManifest(projectRoot);
  const rows = entries.map((entry) => ({
    entry,
    source: manifest.local.includes(entry.id) ? "local" : "unknown"
  }));
  const skillWidth = Math.max("Skill".length, ...rows.map((row) => row.entry.id.length));
  const sourceWidth = Math.max("Source".length, ...rows.map((row) => row.source.length));

  console.log(`  ${"Skill".padEnd(skillWidth)}  ${"Source".padEnd(sourceWidth)}  Description`);
  console.log(`  ${"-".repeat(skillWidth)}  ${"-".repeat(sourceWidth)}  -----------`);

  rows.forEach(({ entry, source }) => {
    const slug = entry.id.padEnd(skillWidth, " ");
    const sourceColumn = source.padEnd(sourceWidth, " ");
    const description = entry.description || entry.name || "(no description)";
    console.log(`  ${slug}  ${sourceColumn}  ${arrow} ${description}`);
  });

  const focusFiles = Array.from(
    new Set([
      ...(options.focus ?? []),
      ...(options.git ? getGitModifiedFiles(projectRoot) : [])
    ])
  );

  if (focusFiles.length === 0) {
    return;
  }

  const insights = buildSkillUsageInsights(entries, focusFiles);
  const matched = insights.filter((insight) => insight.matchedFiles.length > 0);
  const unused = insights.filter((insight) => insight.matchedFiles.length === 0);

  console.log("");
  console.log(`Usage insights (${focusFiles.length} focused file${focusFiles.length === 1 ? "" : "s"})`);
  console.log(`  Matched skills (${matched.length})`);

  matched.forEach((insight) => {
    const detail = insight.alwaysApply
      ? `always apply (${insight.matchedFiles.length} file${insight.matchedFiles.length === 1 ? "" : "s"})`
      : `${insight.matchedFiles.length} match${insight.matchedFiles.length === 1 ? "" : "es"}`;
    console.log(`    - ${insight.id} (${detail})`);
  });

  console.log(`  Unused skills (${unused.length})`);
  unused.forEach((insight) => {
    console.log(`    - ${insight.id}`);
  });
}
