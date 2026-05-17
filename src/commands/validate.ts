import path from "path";
import fs from "fs-extra";
import { getIndexJsonPath, getSkillsDir } from "../utils/paths";
import { listSkillDirectories, parseSkillContent } from "../utils/skills";

export async function validateCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);
  const indexJsonPath = getIndexJsonPath(projectRoot);

  if (!(await fs.pathExists(skillsDir))) {
    console.log("No skills found. Run nymor init first.");
    process.exitCode = 1;
    return;
  }

  const indexExists = await fs.pathExists(indexJsonPath);
  const indexEntries = indexExists ? await fs.readJson(indexJsonPath) : { skills: [] };
  const indexIds = new Set(
    Array.isArray(indexEntries.skills) ? indexEntries.skills.map((entry: { id: string }) => entry.id) : []
  );

  const skillDirs = await listSkillDirectories(skillsDir);

  console.log("Validating skills...\n");

  let errorCount = 0;
  const okMark = "\u2713";
  const errMark = "\u2717";

  for (const dirName of skillDirs) {
    const skillPath = path.join(skillsDir, dirName, "SKILL.md");
    const errors: string[] = [];

    if (!(await fs.pathExists(skillPath))) {
      errors.push("missing SKILL.md");
    } else {
      const content = await fs.readFile(skillPath, "utf8");
      try {
        const { frontmatter, body } = parseSkillContent(content, dirName);

        if (!frontmatter.name) {
          errors.push("missing frontmatter name");
        }

        if (!hasSection(body, "Rule")) {
          errors.push("missing ## Rule section");
        }
        if (!hasSection(body, "Why")) {
          errors.push("missing ## Why section");
        }
        if (!hasSection(body, "Example")) {
          errors.push("missing ## Example section");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
      }
    }

    if (indexExists && !indexIds.has(dirName)) {
      errors.push("not found in index.json");
    }

    if (errors.length === 0) {
      console.log(`  ${okMark} ${dirName}`);
    } else {
      errorCount += 1;
      console.log(`  ${errMark} ${dirName} - ${errors.join("; ")}`);
    }
  }

  if (!indexExists) {
    errorCount += 1;
    console.log("\nIndex not found. Run nymor compile to regenerate index.json.");
  }

  if (errorCount > 0) {
    console.log(`\n${errorCount} issues found. Fix them or run nymor compile again.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll skills look good.");
  }
}

function hasSection(content: string, heading: string): boolean {
  const regex = new RegExp(`^##\\s+${heading}\\b`, "m");
  return regex.test(content);
}
