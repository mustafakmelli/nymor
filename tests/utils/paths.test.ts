import path from "path";
import { describe, expect, it } from "vitest";
import {
  getCicadaDir,
  getIndexJsonPath,
  getIndexMarkdownPath,
  getLockPath,
  getManifestPath,
  getRepoRoot,
  getSkillsDir
} from "../../src/utils/paths";

describe("path utilities", () => {
  it("derives project paths from a root", () => {
    const root = path.join(path.sep, "tmp", "project");

    expect(getRepoRoot(root)).toBe(root);
    expect(getCicadaDir(root)).toBe(path.join(root, ".cicada"));
    expect(getSkillsDir(root)).toBe(path.join(root, ".cicada", "skills"));
    expect(getIndexMarkdownPath(root)).toBe(path.join(root, ".cicada", "index.md"));
    expect(getIndexJsonPath(root)).toBe(path.join(root, ".cicada", "index.json"));
    expect(getManifestPath(root)).toBe(path.join(root, "cicada.json"));
    expect(getLockPath(root)).toBe(path.join(root, "cicada.lock"));
  });
});
