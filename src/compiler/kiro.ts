import fs from "fs-extra";
import path from "path";
import { SkillFile } from "../utils/skills";

export async function compileKiroSkills(skills: SkillFile[], projectRoot: string): Promise<void> {
  const outputRoot = path.join(projectRoot, ".kiro", "steering");
  await fs.ensureDir(outputRoot);

  for (const skill of skills) {
    const fileName = `cicada-${skill.id}.md`;
    const outputPath = path.join(outputRoot, fileName);
    const content = renderKiroSteering(skill);
    await fs.writeFile(outputPath, content, "utf8");
  }
}

function renderKiroSteering(skill: SkillFile): string {
  const inclusion = skill.frontmatter.alwaysApply ? "always" : "manual";
  const lines = ["---", `inclusion: ${inclusion}`, "---", ""];

  return `${lines.join("\n")}\n${skill.body.trimStart()}\n`;
}
