import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import pc from "picocolors";
import { getSkillsDir } from "../utils/paths";
import { loadSkills } from "../utils/skills";

export async function lintCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log(pc.yellow("No skills found. Run nymor init first."));
    return;
  }

  const skills = await loadSkills(skillsDir);
  const lintableSkills = skills.filter(
    (skill) =>
      skill.frontmatter.forbiddenPatterns &&
      skill.frontmatter.forbiddenPatterns.length > 0
  );

  if (lintableSkills.length === 0) {
    console.log(pc.green("✓ No skills define forbiddenPatterns. Linting skipped."));
    return;
  }

  console.log(pc.cyan(`Linting repository against ${lintableSkills.length} skills...\n`));

  let totalViolations = 0;

  for (const skill of lintableSkills) {
    const patterns = skill.frontmatter.forbiddenPatterns || [];
    const globs = skill.frontmatter.globs || [];

    if (globs.length === 0) {
      continue;
    }

    const matchedFiles = new Set<string>();
    for (const pattern of globs) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        nodir: true,
        dot: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/.nymor/**", "**/dist/**"]
      });
      files.forEach((file) => matchedFiles.add(file));
    }

    for (const file of matchedFiles) {
      const filePath = path.join(projectRoot, file);
      if (!(await fs.pathExists(filePath))) {
        continue;
      }

      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/);

      for (const rulePattern of patterns) {
        let isMatch: (line: string) => boolean;

        if (rulePattern.startsWith("/") && rulePattern.endsWith("/")) {
          try {
            const regex = new RegExp(rulePattern.slice(1, -1));
            isMatch = (line) => regex.test(line);
          } catch {
            isMatch = (line) => line.includes(rulePattern);
          }
        } else {
          isMatch = (line) => line.includes(rulePattern);
        }

        for (let i = 0; i < lines.length; i++) {
          if (isMatch(lines[i])) {
            totalViolations++;
            console.log(
              `${pc.red("✗")} ${pc.bold(file)}:${i + 1} - Violated skill ${pc.cyan(
                skill.frontmatter.name
              )}: Found forbidden pattern ${pc.yellow(`"${rulePattern}"`)}`
            );
          }
        }
      }
    }
  }

  console.log("");
  if (totalViolations > 0) {
    console.log(pc.red(`✗ ${totalViolations} lint violations found.`));
    process.exitCode = 1;
  } else {
    console.log(pc.green("✓ All files passed Nymor skill checks."));
  }
}
