import fs from "fs-extra";
import path from "path";
import { SkillFile } from "../utils/skills";

export async function compileCopilotSkills(skills: SkillFile[], projectRoot: string): Promise<void> {
  const outputRoot = path.join(projectRoot, ".github", "instructions");
  await fs.ensureDir(outputRoot);

  for (const skill of skills) {
    const fileName = `cicada-${skill.id}.instructions.md`;
    const outputPath = path.join(outputRoot, fileName);
    const content = renderCopilotInstructions(skill);
    await fs.writeFile(outputPath, content, "utf8");
  }
}

export function renderCopilotInstructions(skill: SkillFile): string {
  const globs = skill.frontmatter.globs ?? [];
  const applyTo = globs.length > 0 ? globs.join(", ") : "**/*";
  const lines = ["---", `applyTo: ${formatYamlValue(applyTo)}`, "---", ""];

  return `${lines.join("\n")}\n${skill.body.trimStart()}\n`;
}

function formatYamlValue(value: string): string {
  const escaped = value.replace(/"/g, "\\\"");
  return `"${escaped}"`;
}
