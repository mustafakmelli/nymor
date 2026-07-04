import path from "path";
import { execSync } from "child_process";

export function getRepoRoot(cwd: string = process.cwd()): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch {
    return cwd;
  }
}

export function getNymorDir(root: string): string {
  return path.join(root, ".nymor");
}

export function getSkillsDir(root: string): string {
  return path.join(getNymorDir(root), "skills");
}

export function getIndexMarkdownPath(root: string): string {
  return path.join(getNymorDir(root), "index.md");
}

export function getIndexJsonPath(root: string): string {
  return path.join(getNymorDir(root), "index.json");
}

export function getManifestPath(root: string): string {
  return path.join(root, "nymor.json");
}
