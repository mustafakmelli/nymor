import path from "path";
import fs from "fs-extra";
import yaml from "yaml";
import pc from "picocolors";
import { getSkillsDir } from "../utils/paths";
import { readManifest, writeManifest } from "../utils/manifest";
import { slugifyRule } from "./learn";
import { compileCommand } from "./compile";

export async function importCommand(options: { fromCursor?: boolean } = {}): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  if (!options.fromCursor) {
    console.log(pc.yellow("Please specify an import source, e.g. --from-cursor"));
    return;
  }

  console.log(pc.cyan("Searching for existing Cursor rules to import...\n"));

  let importedCount = 0;

  // 1. Check for global .cursorrules file
  const globalCursorrulesPath = path.join(projectRoot, ".cursorrules");
  if (await fs.pathExists(globalCursorrulesPath)) {
    console.log(pc.yellow("Found global .cursorrules file. Importing..."));
    const content = await fs.readFile(globalCursorrulesPath, "utf8");
    const slug = "global-cursor-rules";
    const skillPath = path.join(skillsDir, slug, "SKILL.md");

    if (!(await fs.pathExists(skillPath))) {
      await writeSkillFile(skillPath, {
        name: "Global Cursor Rules",
        description: "Imported global .cursorrules instructions",
        globs: ["**/*"],
        alwaysApply: true,
        ruleBody: content
      });
      await registerSkill(projectRoot, slug);
      importedCount++;
      console.log(`${pc.green("✓")} Imported global .cursorrules -> ${pc.bold(slug)}`);
    } else {
      console.log(pc.gray(`  Skipped ${slug} (already exists in Nymor)`));
    }
  }

  // 2. Check for individual MDC rules in .cursor/rules/
  const cursorRulesDir = path.join(projectRoot, ".cursor", "rules");
  if (await fs.pathExists(cursorRulesDir)) {
    const entries = await fs.readdir(cursorRulesDir, { withFileTypes: true });
    const mdcFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".mdc"));

    for (const entry of mdcFiles) {
      // Skip files compiled by Nymor
      if (entry.name.startsWith("nymor-") || entry.name === "nymor.mdc") {
        continue;
      }

      const mdcPath = path.join(cursorRulesDir, entry.name);
      const raw = await fs.readFile(mdcPath, "utf8");
      
      try {
        const { frontmatter, body } = parseMdcContent(raw);
        const name = frontmatter.description || entry.name.slice(0, -4);
        const slug = slugifyRule(entry.name.slice(0, -4));
        const skillPath = path.join(skillsDir, slug, "SKILL.md");

        if (!(await fs.pathExists(skillPath))) {
          await writeSkillFile(skillPath, {
            name,
            description: frontmatter.description || "",
            globs: frontmatter.globs || ["**/*"],
            alwaysApply: frontmatter.alwaysApply !== undefined ? frontmatter.alwaysApply : false,
            ruleBody: body
          });
          await registerSkill(projectRoot, slug);
          importedCount++;
          console.log(`${pc.green("✓")} Imported ${entry.name} -> ${pc.bold(slug)}`);
        } else {
          console.log(pc.gray(`  Skipped ${entry.name} (already exists in Nymor)`));
        }
      } catch (err) {
        console.log(pc.red(`✗ Failed to parse ${entry.name}: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  }

  if (importedCount > 0) {
    console.log(pc.cyan("\nRunning compiler to sync imports to all agent targets..."));
    await compileCommand();
    console.log(pc.green(`\n✓ Successfully imported ${importedCount} rules into Nymor.`));
  } else {
    console.log(pc.yellow("\nNo new Cursor rules were imported."));
  }
}

async function writeSkillFile(
  skillPath: string,
  data: { name: string; description: string; globs: string[]; alwaysApply: boolean; ruleBody: string }
): Promise<void> {
  const frontmatter = yaml.stringify({
    name: data.name,
    description: data.description,
    globs: data.globs,
    alwaysApply: data.alwaysApply
  });

  const content = [
    "---",
    frontmatter.trimEnd(),
    "---",
    "",
    `# Skill: ${data.name}`,
    "",
    "## Rule",
    data.ruleBody.trim(),
    "",
    "## Why",
    "Imported from existing Cursor rules.",
    "",
    "## Example",
    "TBD - add examples",
    ""
  ].join("\n");

  await fs.ensureDir(path.dirname(skillPath));
  await fs.writeFile(skillPath, content, "utf8");
}

async function registerSkill(projectRoot: string, slug: string): Promise<void> {
  const manifest = await readManifest(projectRoot);
  if (!manifest.local.includes(slug)) {
    manifest.local.push(slug);
  }
  await writeManifest(projectRoot, manifest);
}

function parseMdcContent(content: string): { frontmatter: Record<string, any>; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: {}, body: content };
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = lines.slice(1, endIndex + 1).join("\n");
  const body = lines.slice(endIndex + 2).join("\n").trimStart();
  const frontmatter = (yaml.parse(frontmatterText) ?? {}) as Record<string, any>;

  return { frontmatter, body };
}
