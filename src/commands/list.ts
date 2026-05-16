import fs from "fs-extra";
import { getIndexJsonPath, getSkillsDir } from "../utils/paths";
import { loadSkills, SkillIndexEntry } from "../utils/skills";

export async function listCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);
  const indexJsonPath = getIndexJsonPath(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log("No skills found. Run cicada init first.");
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

  console.log(`Cicada Skills (${entries.length})`);
  console.log("");

  if (entries.length === 0) {
    return;
  }

  const arrow = "\u2192";
  const maxLength = Math.max(...entries.map((entry) => entry.id.length));

  entries.forEach((entry) => {
    const slug = entry.id.padEnd(maxLength + 2, " ");
    const description = entry.description || entry.name || "(no description)";
    console.log(`  ${slug}${arrow} ${description}`);
  });
}
