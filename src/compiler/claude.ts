import fs from "fs-extra";
import path from "path";
import { SkillFile } from "../utils/skills";

export async function compileClaudeSkills(skills: SkillFile[], projectRoot: string): Promise<void> {
  const outputRoot = path.join(projectRoot, ".claude", "skills");
  await fs.ensureDir(outputRoot);

  for (const skill of skills) {
    const targetDir = path.join(outputRoot, skill.id);
    await fs.copy(skill.dirPath, targetDir, { overwrite: true });
  }
}
