import path from "path";

export function getRepoRoot(cwd: string = process.cwd()): string {
  return cwd;
}

export function getCicadaDir(root: string): string {
  return path.join(root, ".cicada");
}

export function getSkillsDir(root: string): string {
  return path.join(getCicadaDir(root), "skills");
}

export function getIndexMarkdownPath(root: string): string {
  return path.join(getCicadaDir(root), "index.md");
}

export function getIndexJsonPath(root: string): string {
  return path.join(getCicadaDir(root), "index.json");
}

export function getManifestPath(root: string): string {
  return path.join(root, "cicada.json");
}

export function getLockPath(root: string): string {
  return path.join(root, "cicada.lock");
}
