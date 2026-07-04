import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import yaml from "yaml";
import pc from "picocolors";
import { AGENT_TARGETS, AgentTarget } from "../agents/targets";
import { planCompileOutputs } from "./compile";
import { NymorManifest } from "../utils/manifest";
import { getManifestPath, getSkillsDir } from "../utils/paths";
import { listSkillDirectories } from "../utils/skills";

const VALID_AGENTS: AgentTarget[] = AGENT_TARGETS.map((target) => target.id);
const REQUIRED_SECTIONS = ["Rule", "Why", "Example"];

interface CheckResult {
  ok: boolean;
  warn?: boolean;
  label: string;
  filePath: string;
  message: string;
}

interface ParsedSkillFrontmatter {
  id: string;
  filePath: string;
  name: string;
  globs: string[];
  alwaysApply: boolean;
  valid: boolean;
}

export async function doctorCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const results: CheckResult[] = [];

  await checkManifest(projectRoot, results);
  const frontmatters = await checkSkillFrontmatter(projectRoot, results);
  await checkGlobExistence(projectRoot, frontmatters, results);
  checkDuplicateNames(projectRoot, frontmatters, results);
  await checkCompiledOutput(projectRoot, results);

  for (const result of results) {
    const icon = result.warn ? pc.yellow("WARN") : result.ok ? pc.green("PASS") : pc.red("FAIL");
    const location = pc.dim(result.filePath);
    const msg = result.message ? ` — ${result.message}` : "";
    console.log(`${icon}  ${result.label}${msg}`);
    if (result.message) {
      console.log(`     ${location}`);
    }
  }

  const failures = results.filter((r) => !r.ok && !r.warn);
  console.log("");
  if (failures.length === 0) {
    console.log(pc.green("✓ All checks passed."));
  } else {
    console.log(pc.red(`✗ ${failures.length} issue${failures.length === 1 ? "" : "s"} found.`));
    process.exitCode = 1;
  }
}

async function checkManifest(projectRoot: string, results: CheckResult[]): Promise<NymorManifest | null> {
  const manifestPath = getManifestPath(projectRoot);

  try {
    const manifest = (await fs.readJson(manifestPath)) as NymorManifest;
    const errors: string[] = [];

    if (manifest.version !== "1") {
      errors.push('version must be "1"');
    }

    const invalidAgents = (manifest.agents ?? []).filter((agent) => !VALID_AGENTS.includes(agent));
    if (invalidAgents.length > 0) {
      errors.push(`invalid agents: ${invalidAgents.join(", ")}`);
    }

    results.push({
      ok: errors.length === 0,
      label: "Manifest (nymor.json)",
      filePath: manifestPath,
      message: errors.join("; ")
    });

    return errors.length === 0 ? normalizeManifest(manifest) : null;
  } catch (err) {
    results.push({
      ok: false,
      label: "Manifest (nymor.json)",
      filePath: manifestPath,
      message: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

async function checkSkillFrontmatter(projectRoot: string, results: CheckResult[]): Promise<ParsedSkillFrontmatter[]> {
  const skillsDir = getSkillsDir(projectRoot);
  const skillDirs = await listSkillDirectories(skillsDir);
  const parsed: ParsedSkillFrontmatter[] = [];

  for (const id of skillDirs) {
    const skillPath = path.join(skillsDir, id, "SKILL.md");
    const errors: string[] = [];
    let frontmatter: Record<string, unknown> = {};
    let body = "";

    if (!(await fs.pathExists(skillPath))) {
      errors.push("missing SKILL.md");
    } else {
      const raw = await fs.readFile(skillPath, "utf8");
      try {
        const parsed = parseFrontmatterAndBody(raw);
        frontmatter = parsed.frontmatter;
        body = parsed.body;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (!frontmatter.name) {
      errors.push("missing name in frontmatter");
    }
    if (frontmatter.globs !== undefined && !Array.isArray(frontmatter.globs)) {
      errors.push("globs must be an array");
    }

    // Absorbed from validate: check required sections
    for (const section of REQUIRED_SECTIONS) {
      if (body && !hasSection(body, section)) {
        errors.push(`missing ## ${section} section`);
      }
    }

    const isValid = errors.length === 0;
    results.push({
      ok: isValid,
      label: `Skill: ${id}`,
      filePath: skillPath,
      message: errors.join("; ")
    });

    parsed.push({
      id,
      filePath: skillPath,
      name: typeof frontmatter.name === "string" ? frontmatter.name : "",
      globs: Array.isArray(frontmatter.globs) ? frontmatter.globs.map(String) : [],
      alwaysApply: Boolean(frontmatter.alwaysApply),
      valid: isValid
    });
  }

  return parsed;
}

async function checkGlobExistence(
  projectRoot: string,
  frontmatters: ParsedSkillFrontmatter[],
  results: CheckResult[]
): Promise<void> {
  for (const skill of frontmatters) {
    if (!skill.valid || skill.alwaysApply || skill.globs.length === 0) {
      continue;
    }

    const missing: string[] = [];
    for (const pattern of skill.globs) {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        nodir: true,
        dot: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/.nymor/**"]
      });
      if (matches.length === 0) {
        missing.push(pattern);
      }
    }

    if (missing.length > 0) {
      results.push({
        ok: false,
        warn: true,
        label: `Glob scope: ${skill.id}`,
        filePath: skill.filePath,
        message: `no files match: ${missing.join(", ")}`
      });
    }
  }
}

function checkDuplicateNames(
  projectRoot: string,
  frontmatters: ParsedSkillFrontmatter[],
  results: CheckResult[]
): void {
  const seen = new Map<string, ParsedSkillFrontmatter>();

  for (const skill of frontmatters.filter((item) => item.valid)) {
    const previous = seen.get(skill.name);
    if (previous) {
      results.push({
        ok: false,
        label: "Duplicate skill name",
        filePath: skill.filePath,
        message: `"${skill.name}" already used in ${path.basename(path.dirname(previous.filePath))}`
      });
    } else {
      seen.set(skill.name, skill);
    }
  }
}

async function checkCompiledOutput(projectRoot: string, results: CheckResult[]): Promise<void> {
  try {
    const planned = await planCompileOutputs(projectRoot);
    const stale: string[] = [];

    for (const file of planned) {
      if (!(await fs.pathExists(file.path))) {
        stale.push(path.relative(projectRoot, file.path));
        continue;
      }

      const actual = await fs.readFile(file.path);
      if (!actual.equals(file.content)) {
        stale.push(path.relative(projectRoot, file.path));
      }
    }

    results.push({
      ok: stale.length === 0,
      label: "Compiled outputs",
      filePath: projectRoot,
      message: stale.length > 0 ? `${stale.length} stale — run \`nymor sync\`` : ""
    });
  } catch (err) {
    results.push({
      ok: false,
      label: "Compiled outputs",
      filePath: projectRoot,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

function parseFrontmatterAndBody(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("missing frontmatter (expected --- on first line)");
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    throw new Error("frontmatter is not closed (missing closing ---)");
  }

  const frontmatter = (yaml.parse(lines.slice(1, endIndex + 1).join("\n")) ?? {}) as Record<string, unknown>;
  const body = lines.slice(endIndex + 2).join("\n").trimStart();

  return { frontmatter, body };
}

function hasSection(body: string, heading: string): boolean {
  return new RegExp(`^##\\s+${heading}\\b`, "m").test(body);
}

function normalizeManifest(manifest: NymorManifest): NymorManifest {
  return {
    version: manifest.version,
    agents: manifest.agents ?? [],
    local: manifest.local ?? []
  };
}
