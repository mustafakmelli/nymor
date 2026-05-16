import { execFile, execFileSync, spawnSync } from "child_process";
import http from "http";
import type { AddressInfo } from "net";
import os from "os";
import path from "path";
import fs from "fs-extra";
import { beforeAll, describe, expect, it } from "vitest";
import { promisify } from "util";

const repoRoot = path.resolve(__dirname, "..", "..");
const cliPath = path.join(repoRoot, "dist", "index.js");
const registryRoot = path.join(repoRoot, "tests", "fixtures", "registry");
const execFileAsync = promisify(execFile);

describe("cicada CLI", () => {
  beforeAll(() => {
    execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  }, 60_000);

  it("initializes, compiles idempotently, and passes doctor", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-e2e-"));
    await fs.writeJson(path.join(projectRoot, "package.json"), { name: "fixture", version: "1.0.0" });

    runCli(["init"], projectRoot);
    runCli(["compile"], projectRoot);
    const before = await readTree(projectRoot);
    runCli(["compile"], projectRoot);
    const after = await readTree(projectRoot);

    expect(after).toEqual(before);
    runCli(["doctor"], projectRoot);
  }, 60_000);

  it("adds a registry skill, writes the lockfile, and reinstalls offline from cache", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-add-"));
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-home-"));
    await fs.writeJson(path.join(projectRoot, "cicada.json"), {
      version: "1",
      agents: [],
      skills: {},
      local: []
    });

    const server = await startRegistryServer();
    await runCliAsync(["add", "@cicada/commit-conventions"], projectRoot, {
      CICADA_REGISTRY_URL: server.url,
      HOME: home
    });
    await server.close();

    await expect(fs.pathExists(path.join(projectRoot, ".cicada", "skills", "@cicada__commit-conventions", "SKILL.md"))).resolves.toBe(
      true
    );
    await expect(fs.readJson(path.join(projectRoot, "cicada.lock"))).resolves.toMatchObject({
      skills: {
        "@cicada/commit-conventions": {
          version: "1.0.0",
          integrity: expect.stringMatching(/^sha256-/)
        }
      }
    });

    await fs.remove(path.join(projectRoot, ".cicada", "skills", "@cicada__commit-conventions"));
    await runCliAsync(["add", "--offline", "@cicada/commit-conventions"], projectRoot, { HOME: home });
    await expect(fs.pathExists(path.join(projectRoot, ".cicada", "skills", "@cicada__commit-conventions", "SKILL.md"))).resolves.toBe(
      true
    );
  }, 60_000);

  it("doctor flags broken globs", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-doctor-"));
    await fs.writeJson(path.join(projectRoot, "cicada.json"), {
      version: "1",
      agents: [],
      skills: {},
      local: ["broken"]
    });
    await fs.outputFile(
      path.join(projectRoot, ".cicada", "skills", "broken", "SKILL.md"),
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

    runCli(["compile"], projectRoot);
    const result = spawnSync(process.execPath, [cliPath, "doctor"], {
      cwd: projectRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("no matches: nope/**/*.fake");
  }, 60_000);
});

function runCli(args: string[], cwd: string, env: Record<string, string> = {}): void {
  execFileSync(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
}

async function runCliAsync(args: string[], cwd: string, env: Record<string, string> = {}): Promise<void> {
  await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, ...env },
    timeout: 60_000
  });
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

async function startRegistryServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const filePath = path.join(registryRoot, requestPath);

    if (!filePath.startsWith(registryRoot) || !(await fs.pathExists(filePath))) {
      response.writeHead(404).end();
      return;
    }

    const body = await fs.readFile(filePath);
    response.setHeader("Connection", "close");
    response.setHeader("Content-Length", body.length);
    response.writeHead(200);
    response.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}
