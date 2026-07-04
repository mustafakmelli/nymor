import { execFileSync, spawnSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs-extra";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");
const cliPath = path.join(repoRoot, "dist", "index.js");

describe("nymor CLI", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  }, 60_000);

  it("sync initializes empty local memory and compiles idempotently", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-e2e-"));
    await fs.writeJson(path.join(projectRoot, "package.json"), { name: "fixture", version: "1.0.0" });

    runCli(["sync", "--agents", "claude"], projectRoot);

    await expect(fs.pathExists(path.join(projectRoot, ".nymor", "skills"))).resolves.toBe(true);
    await expect(fs.readJson(path.join(projectRoot, "nymor.json"))).resolves.toMatchObject({ local: [] });

    // Idempotent: sync twice should produce same result
    const before = await readTree(projectRoot);
    runCli(["sync", "--agents", "claude"], projectRoot);
    const after = await readTree(projectRoot);
    expect(after).toEqual(before);
  }, 60_000);

  it("shows clean 6-command help surface", () => {
    const result = spawnSync(process.execPath, [cliPath, "--help"], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nymor");
    expect(result.stdout).toContain("sync");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("status");
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("watch");
    expect(result.stdout).toContain("mcp");
    // Removed commands must not appear
    expect(result.stdout).not.toContain("learn");
    expect(result.stdout).not.toContain("init");
    expect(result.stdout).not.toContain("compile");
    expect(result.stdout).not.toContain("validate");
    expect(result.stdout).not.toContain("lint");
    expect(result.stdout).not.toContain("mine");
    expect(result.stdout).not.toContain("import");
  });

  it("keeps the README focused on nymor sync", async () => {
    const readme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8");

    expect(readme).toContain("# Nymor");
    expect(readme).toContain("/nymor-learn");
    expect(readme).toContain("nymor sync");
    for (const forbidden of ["Cicada", "cicada", "registry", "draft", "approve", "starter skills"]) {
      expect(readme).not.toContain(forbidden);
    }
  });

  it("keeps the hidden learn fallback working", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-learn-"));
    await fs.writeJson(path.join(projectRoot, "nymor.json"), {
      version: "1",
      agents: [],
      local: []
    });

    runCli(
      [
        "learn",
        "Use Server Actions for all mutations",
        "--id",
        "server-actions-only",
        "--name",
        "Server Actions Only",
        "--description",
        "Use this when changing app mutations",
        "--globs",
        "app/**/*.ts,app/**/*.tsx",
        "--why",
        "Keeps mutations close to UI and simplifies auth.",
        "--example",
        "Prefer an exported 'use server' action over a new API route."
      ],
      projectRoot
    );

    const skillPath = path.join(projectRoot, ".nymor", "skills", "server-actions-only", "SKILL.md");
    await expect(fs.readFile(skillPath, "utf8")).resolves.toContain("Keeps mutations close to UI and simplifies auth.");
    await expect(fs.readJson(path.join(projectRoot, "nymor.json"))).resolves.toMatchObject({
      local: ["server-actions-only"]
    });
  }, 60_000);

  it("writes Nymor outputs for the common agent set", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-agents-"));
    await fs.writeJson(path.join(projectRoot, "nymor.json"), {
      version: "1",
      agents: ["claude", "cursor", "copilot", "kiro", "agents-md", "gemini", "windsurf", "goose", "opencode"],
      local: ["demo"]
    });
    await writeDemoSkill(projectRoot);

    runCli(["sync", "--agents", "claude", "cursor", "copilot", "kiro", "agents-md", "gemini", "windsurf", "goose", "opencode"], projectRoot);

    await expect(fs.pathExists(path.join(projectRoot, ".claude", "skills", "demo", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".cursor", "rules", "nymor-demo.mdc"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".github", "instructions", "nymor-demo.instructions.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".github", "prompts", "nymor-learn.prompt.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".kiro", "steering", "nymor-demo.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".goose", "skills", "demo", "SKILL.md"))).resolves.toBe(true);
    await expect(fs.pathExists(path.join(projectRoot, ".opencode", "skill", "demo", "SKILL.md"))).resolves.toBe(true);

    await expect(fs.readFile(path.join(projectRoot, ".claude", "commands", "nymor-learn.md"), "utf8")).resolves.toContain(
      "This looks like a reusable repo rule. Want me to capture it with /nymor-learn?"
    );
    await expect(fs.readFile(path.join(projectRoot, "AGENTS.md"), "utf8")).resolves.toContain("<!-- nymor:start -->");
    await expect(fs.readFile(path.join(projectRoot, "GEMINI.md"), "utf8")).resolves.toContain("/nymor-learn");
    await expect(fs.readFile(path.join(projectRoot, ".windsurf", "rules", "nymor.md"), "utf8")).resolves.toContain(
      ".nymor/skills/"
    );
  }, 60_000);

  it("doctor flags broken globs", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-doctor-"));
    await fs.writeJson(path.join(projectRoot, "nymor.json"), {
      version: "1",
      agents: [],
      local: ["broken"]
    });
    await fs.outputFile(
      path.join(projectRoot, ".nymor", "skills", "broken", "SKILL.md"),
      [
        "---",
        "name: Broken Glob",
        "globs:",
        "  - nope/**/*.fake",
        "alwaysApply: false",
        "---",
        "",
        "## Rule",
        "Use matching globs.",
        "",
        "## Why",
        "Doctor should catch broken scope.",
        "",
        "## Example",
        "nope"
      ].join("\n"),
      "utf8"
    );

    runCli(["sync", "--agents", "agents-md"], projectRoot);
    const result = spawnSync(process.execPath, [cliPath, "doctor"], {
      cwd: projectRoot,
      encoding: "utf8"
    });

    // Broken globs are flagged as WARN (not FAIL) — exit code 0 but message is present
    expect(`${result.stdout}${result.stderr}`).toContain("no files match: nope/**/*.fake");
  }, 60_000);
});

function runCli(args: string[], cwd: string, env: Record<string, string> = {}): void {
  execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
}

async function writeDemoSkill(projectRoot: string): Promise<void> {
  await fs.outputFile(
    path.join(projectRoot, ".nymor", "skills", "demo", "SKILL.md"),
    [
      "---",
      "name: Demo",
      "description: Demo skill",
      "globs:",
      '  - "**/*"',
      "alwaysApply: true",
      "---",
      "",
      "## Rule",
      "Use demos.",
      "",
      "## Why",
      "For tests.",
      "",
      "## Example",
      "demo"
    ].join("\n"),
    "utf8"
  );
}

async function readTree(root: string): Promise<Record<string, string>> {
  const files = (await listFiles(root)).filter((file) => !file.includes(`${path.sep}.git${path.sep}`));
  const output: Record<string, string> = {};

  for (const file of files) {
    output[path.relative(root, file)] = await fs.readFile(file, "utf8");
  }

  return output;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files.sort();
}
