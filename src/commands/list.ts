import fs from "fs-extra";
import { getIndexJsonPath, getSkillsDir } from "../utils/paths";
import { loadSkills, SkillIndexEntry } from "../utils/skills";
import { readManifest } from "../utils/manifest";

export async function listCommand(): Promise<void> {
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
}
