import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import yaml from "yaml";
import { planCompileOutputs } from "./compile";
import { AgentTarget, CicadaManifest, readLockfile } from "../utils/manifest";
import { getManifestPath, getSkillsDir } from "../utils/paths";
import { listSkillDirectories } from "../utils/skills";

const VALID_AGENTS: AgentTarget[] = ["claude", "cursor", "copilot", "kiro", "agents-md"];

interface CheckResult {
  ok: boolean;
  label: string;
  filePath: string;
  message: string;
  warn?: boolean;
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

  const manifest = await checkManifest(projectRoot, results);
  await checkLockfile(projectRoot, manifest, results);
  const frontmatters = await checkSkillFrontmatter(projectRoot, results);
  await checkGlobExistence(projectRoot, frontmatters, results);
  checkDuplicateNames(projectRoot, frontmatters, results);
  await checkCompiledOutput(projectRoot, results);

  for (const result of results) {
    const status = result.warn ? "WARN" : result.ok ? "PASS" : "FAIL";
    console.log(`${status} ${result.label} - ${result.filePath}${result.message ? ` - ${result.message}` : ""}`);
  }

  if (results.some((result) => !result.ok && !result.warn)) {
    process.exitCode = 1;
  }
}

async function checkManifest(projectRoot: string, results: CheckResult[]): Promise<CicadaManifest | null> {
  const manifestPath = getManifestPath(projectRoot);

  try {
    const manifest = (await fs.readJson(manifestPath)) as CicadaManifest;
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
      label: "Manifest sanity",
      filePath: manifestPath,
      message: errors.join("; ")
    });

    return errors.length === 0 ? normalizeManifest(manifest) : null;
  } catch (err) {
    results.push({
      ok: false,
      label: "Manifest sanity",
      filePath: manifestPath,
      message: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

async function checkLockfile(
  projectRoot: string,
  manifest: CicadaManifest | null,
  results: CheckResult[]
): Promise<void> {
  const lockPath = path.join(projectRoot, "cicada.lock");
  let lockfile: Awaited<ReturnType<typeof readLockfile>>;

  try {
    lockfile = await readLockfile(projectRoot);
  } catch (err) {
    results.push({
      ok: false,
      label: "Lockfile sync",
      filePath: lockPath,
      message: err instanceof Error ? err.message : String(err)
    });
    return;
  }

  if (!manifest) {
    results.push({
      ok: false,
      label: "Lockfile sync",
      filePath: lockPath,
      message: "manifest could not be read"
    });
    return;
  }

  const missing = Object.keys(manifest.skills).filter((skill) => !lockfile?.skills[skill]);
  results.push({
    ok: missing.length === 0,
    label: "Lockfile sync",
    filePath: lockPath,
    message: missing.length > 0 ? `missing entries: ${missing.join(", ")}` : ""
  });

  if (lockfile) {
    const extra = Object.keys(lockfile.skills).filter((skill) => !manifest.skills[skill]);
    if (extra.length > 0) {
      results.push({
        ok: true,
        warn: true,
        label: "Lockfile sync",
        filePath: lockPath,
        message: `unused entries: ${extra.join(", ")}`
      });
    }
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

    if (!(await fs.pathExists(skillPath))) {
      errors.push("missing SKILL.md");
    } else {
      try {
        frontmatter = parseFrontmatter(await fs.readFile(skillPath, "utf8"));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (!frontmatter.name) {
      errors.push("missing name");
    }
    if (frontmatter.globs !== undefined && !Array.isArray(frontmatter.globs)) {
      errors.push("globs must be an array");
    }

    const isValid = errors.length === 0;
    results.push({
      ok: isValid,
      label: "Frontmatter validity",
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
        ignore: ["**/node_modules/**", "**/.git/**"]
      });
      if (matches.length === 0) {
        missing.push(pattern);
      }
    }

    results.push({
      ok: missing.length === 0,
      label: "Glob existence",
      filePath: skill.filePath,
      message: missing.length > 0 ? `no matches: ${missing.join(", ")}` : ""
    });
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
        label: "Duplicate names",
        filePath: skill.filePath,
        message: `duplicates ${previous.filePath}`
      });
    } else {
      seen.set(skill.name, skill);
    }
  }

  if (![...seen.values()].some((skill) => hasDuplicate(skill.name, frontmatters))) {
    results.push({
      ok: true,
      label: "Duplicate names",
      filePath: getSkillsDir(projectRoot),
      message: ""
    });
  }
}

async function checkCompiledOutput(projectRoot: string, results: CheckResult[]): Promise<void> {
  try {
    const planned = await planCompileOutputs(projectRoot);
    const stale: string[] = [];

    for (const file of planned) {
      if (!(await fs.pathExists(file.path))) {
        stale.push(file.path);
        continue;
      }

      const actual = await fs.readFile(file.path);
      if (!actual.equals(file.content)) {
        stale.push(file.path);
      }
    }

    results.push({
      ok: stale.length === 0,
      label: "Compiled output staleness",
      filePath: projectRoot,
      message: stale.length > 0 ? "run `cicada compile`" : ""
    });
  } catch (err) {
    results.push({
      ok: false,
      label: "Compiled output staleness",
      filePath: projectRoot,
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("missing frontmatter");
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (endIndex === -1) {
    throw new Error("frontmatter is not closed");
  }

  return (yaml.parse(lines.slice(1, endIndex + 1).join("\n")) ?? {}) as Record<string, unknown>;
}

function normalizeManifest(manifest: CicadaManifest): CicadaManifest {
  return {
    version: manifest.version,
    agents: manifest.agents ?? [],
    skills: manifest.skills ?? {},
    local: manifest.local ?? []
  };
}

function hasDuplicate(name: string, frontmatters: ParsedSkillFrontmatter[]): boolean {
  return frontmatters.filter((skill) => skill.valid && skill.name === name).length > 1;
}
