import os from "os";
import path from "path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { compileClaudeSkills } from "../../src/compiler/claude";
import { loadSkills } from "../../src/utils/skills";

const fixturesDir = path.resolve(__dirname, "..", "fixtures", "skills");

describe("compileClaudeSkills", () => {
  it("copies every skill folder", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-claude-"));
    const skills = await loadSkills(fixturesDir);

    await compileClaudeSkills(skills, projectRoot);

    expect(await readTree(path.join(projectRoot, ".claude", "skills"))).toMatchSnapshot();
  });
});

async function readTree(root: string): Promise<Record<string, string>> {
  const files = await listFiles(root);
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
