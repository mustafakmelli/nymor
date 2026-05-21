import fs from "fs-extra";
import path from "path";
import { SkillFile } from "../utils/skills";

export async function compileClineSkills(skills: SkillFile[], projectRoot: string): Promise<void> {
  const outputRoot = path.join(projectRoot, ".cline", "rules");
  await fs.ensureDir(outputRoot);

  for (const skill of skills) {
    const fileName = `nymor-${skill.id}.md`;
    const outputPath = path.join(outputRoot, fileName);
    const content = renderClineRule(skill);
    await fs.writeFile(outputPath, content, "utf8");
  }
}

export function renderClineRule(skill: SkillFile): string {
  const description = skill.frontmatter.description || skill.frontmatter.name;
  const globs = skill.frontmatter.globs ?? [];
  const alwaysApply = Boolean(skill.frontmatter.alwaysApply);
  const lines: string[] = ["---", `description: ${formatYamlValue(description)}`];

  if (globs.length > 0) {
    lines.push("globs:");
    globs.forEach((glob) => lines.push(`  - ${formatYamlValue(glob)}`));
  } else {
    lines.push("globs: []");
  }

  lines.push(`alwaysApply: ${alwaysApply}`, "---", "");

  return `${lines.join("\n")}\n${skill.body.trimStart()}\n`;
}

function formatYamlValue(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}