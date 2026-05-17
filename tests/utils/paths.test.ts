import path from "path";
import { describe, expect, it } from "vitest";
import {
  getIndexJsonPath,
  getIndexMarkdownPath,
  getManifestPath,
  getNymorDir,
  getRepoRoot,
  getSkillsDir
} from "../../src/utils/paths";

describe("path utilities", () => {
  it("derives project paths from a root", () => {
    const root = path.join(path.sep, "tmp", "project");

    expect(getRepoRoot(root)).toBe(root);
    expect(getNymorDir(root)).toBe(path.join(root, ".nymor"));
    expect(getSkillsDir(root)).toBe(path.join(root, ".nymor", "skills"));
    expect(getIndexMarkdownPath(root)).toBe(path.join(root, ".nymor", "index.md"));
    expect(getIndexJsonPath(root)).toBe(path.join(root, ".nymor", "index.json"));
    expect(getManifestPath(root)).toBe(path.join(root, "nymor.json"));
  });
});
