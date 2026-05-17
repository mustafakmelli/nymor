import path from "path";

export function getRepoRoot(cwd: string = process.cwd()): string {
  return cwd;
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
