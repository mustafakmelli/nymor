import fs from "fs-extra";
import path from "path";
import { SkillFile } from "../utils/skills";

export async function compileCodeWhispererSkills(skills: SkillFile[], projectRoot: string): Promise<void> {
  const outputPath = path.join(projectRoot, "CODEWHISPERER.md");
  const content = renderCodeWhispererSkills(skills);
  await fs.writeFile(outputPath, content, "utf8");
}

export function renderCodeWhispererSkills(skills: SkillFile[]): string {
  const lines: string[] = [
    "# Amazon CodeWhisperer Custom Guidance",
    "",
    "> This file is managed by Nymor. Do not edit directly.",
    "",
    "The following skills define custom guidance for Amazon CodeWhisperer.",
    ""
  ];

  for (const skill of skills) {
    lines.push(`## ${skill.frontmatter.name}`);
    lines.push("");
    lines.push(skill.body.trim());
    lines.push("");
  }

  return lines.join("\n");
}