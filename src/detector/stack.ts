import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

export type Stack = "nodejs" | "react" | "fullstack" | "python" | "generic";

const SIGNALS: Record<Exclude<Stack, "generic" | "nodejs">, string[]> = {
  react: ["src/App.tsx", "src/App.jsx", "next.config.js", "next.config.ts", "vite.config.ts"],
  python: ["requirements.txt", "pyproject.toml", "setup.py", "manage.py"],
  fullstack: ["next.config.js", "next.config.ts", "remix.config.js"]
};

const NODE_DEPENDENCIES = new Set(["express", "fastify", "koa", "hapi"]);

export async function detectStack(projectRoot: string): Promise<Stack> {
  const detected: Stack[] = [];

  const packageJsonPath = path.join(projectRoot, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const pkg = await fs.readJson(packageJsonPath);
      const dependencies = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {})
      } as Record<string, string>;

      const hasNodeDependency = Object.keys(dependencies).some((dep) => NODE_DEPENDENCIES.has(dep));
      if (hasNodeDependency) {
        detected.push("nodejs");
      }
    } catch {
      // Ignore invalid package.json and continue with file signals.
    }
  }

  if (await hasAnySignal(projectRoot, SIGNALS.react)) {
    detected.push("react");
  }

  if (await hasAnySignal(projectRoot, SIGNALS.python)) {
    detected.push("python");
  }

  if (await hasAnySignal(projectRoot, SIGNALS.fullstack)) {
    detected.push("fullstack");
  }

  if (detected.length === 0) {
    return "generic";
  }

  if (detected.length > 1) {
    return "fullstack";
  }

  return detected[0];
}

async function hasAnySignal(projectRoot: string, patterns: string[]): Promise<boolean> {
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectRoot,
      nodir: true,
      dot: true,
      ignore: ["**/node_modules/**", "**/.git/**"]
    });

    if (matches.length > 0) {
      return true;
    }
  }

  return false;
}
