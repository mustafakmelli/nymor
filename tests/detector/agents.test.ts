import os from "os";
import path from "path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { detectAgents } from "../../src/detector/agents";

describe("detectAgents", () => {
  it("detects known agent surfaces", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-agents-"));
    await fs.ensureDir(path.join(projectRoot, ".claude"));
    await fs.ensureDir(path.join(projectRoot, ".cursor"));
    await fs.ensureDir(path.join(projectRoot, ".github", "instructions"));
    await fs.ensureDir(path.join(projectRoot, ".kiro"));
    await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "agents", "utf8");
    await fs.writeFile(path.join(projectRoot, "GEMINI.md"), "gemini", "utf8");
    await fs.ensureDir(path.join(projectRoot, ".windsurf"));
    await fs.ensureDir(path.join(projectRoot, ".goose"));
    await fs.ensureDir(path.join(projectRoot, ".opencode"));

    await expect(detectAgents(projectRoot)).resolves.toEqual({
      claude: true,
      cursor: true,
      copilot: true,
      kiro: true,
      "agents-md": true,
      gemini: true,
      windsurf: true,
      goose: true,
      opencode: true
    });
  });

  it("returns false for absent agents", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-agents-"));

    await expect(detectAgents(projectRoot)).resolves.toEqual({
      claude: false,
      cursor: false,
      copilot: false,
      kiro: false,
      "agents-md": false,
      gemini: false,
      windsurf: false,
      goose: false,
      opencode: false
    });
  });
});
