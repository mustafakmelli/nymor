import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import inquirer from "inquirer";
import pc from "picocolors";
import { getSkillsDir } from "../utils/paths";
import { loadSkills } from "../utils/skills";
import { learnCommand, slugifyRule } from "./learn";

interface Candidate {
  rule: string;
  filePath: string;
  line: number;
}

export async function mineCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  const existingSkills = await loadSkills(skillsDir);
  const existingSlugs = new Set(existingSkills.map((s) => s.id));

  console.log(pc.cyan("Scanning codebase for inline 'nymor-learn:' comments...\n"));

  const files = await glob("**/*", {
    cwd: projectRoot,
    nodir: true,
    dot: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.nymor/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml"
    ]
  });

  const candidates: Candidate[] = [];

  const doubleSlashRegex = /(?:^|\s)\/\/\s*nymor-learn:\s*(.+)$/i;
  const blockCommentRegex = /\/\*\s*nymor-learn:\s*([^*]+)\*\//i;
  const hashCommentRegex = /(?:^|\s)#\s*nymor-learn:\s*(.+)$/i;

  for (const file of files) {
    const filePath = path.join(projectRoot, file);
    
    // Skip binary files by checking file extension or size
    const ext = path.extname(file).toLowerCase();
    const skippableExtensions = [
      ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf", ".zip", ".tar", ".gz", ".mp3", ".mp4"
    ];
    if (skippableExtensions.includes(ext)) {
      continue;
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 1024 * 1024) {
        // Skip files larger than 1MB
        continue;
      }

      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let ruleMatch = line.match(doubleSlashRegex) || line.match(blockCommentRegex) || line.match(hashCommentRegex);

        if (ruleMatch && ruleMatch[1]) {
          const rule = ruleMatch[1].trim();
          const slug = slugifyRule(rule);

          if (!existingSlugs.has(slug)) {
            candidates.push({
              rule,
              filePath: file,
              line: i + 1
            });
          }
        }
      }
    } catch {
      // Ignore reading errors for binary or restricted files
    }
  }

  if (candidates.length === 0) {
    console.log(pc.green("✓ No new inline skill candidates found in comments."));
    return;
  }

  console.log(pc.yellow(`Found ${candidates.length} new skill candidates in comments:\n`));

  candidates.forEach((cand, index) => {
    console.log(
      `  [${index + 1}] ${pc.bold(cand.filePath)}:${cand.line}\n      "${pc.green(cand.rule)}"\n`
    );
  });

  if (!process.stdin.isTTY) {
    console.log(pc.yellow("Run in an interactive terminal to capture these candidates."));
    return;
  }

  const answers = await inquirer.prompt<{ selectedIndexes: number[] }>([
    {
      type: "checkbox",
      name: "selectedIndexes",
      message: "Select candidates to capture as Nymor repository skills:",
      choices: candidates.map((cand, index) => ({
        name: `[${index + 1}] ${cand.filePath} - ${cand.rule.slice(0, 50)}...`,
        value: index
      }))
    }
  ]);

  if (answers.selectedIndexes.length === 0) {
    console.log(pc.cyan("No skills captured."));
    return;
  }

  for (const index of answers.selectedIndexes) {
    const candidate = candidates[index];
    console.log(pc.cyan(`\nCapturing skill: "${candidate.rule}"`));
    await learnCommand(candidate.rule, {
      name: undefined,
      description: `Captured from comment in ${candidate.filePath}:${candidate.line}`,
      globs: candidate.filePath,
      alwaysApply: false
    });
  }
}
