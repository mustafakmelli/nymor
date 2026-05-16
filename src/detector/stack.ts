import fs from "fs-extra";
import path from "path";
import { glob } from "glob";

export type Stack = "nodejs" | "react" | "vue" | "fullstack" | "python" | "django" | "fastapi" | "rust" | "go";

const NODE_DEPENDENCIES = new Set(["express", "fastify", "koa", "hapi", "@nestjs/core"]);
const REACT_DEPENDENCIES = new Set(["react", "next", "@remix-run/react"]);
const VUE_DEPENDENCIES = new Set(["vue", "nuxt", "@nuxt/schema"]);
const FULLSTACK_DEPENDENCIES = new Set(["next", "@remix-run/react"]);

const SIGNALS: Record<Stack, string[]> = {
  nodejs: ["server.js", "server.ts", "src/server.ts", "src/server.js"],
  react: ["src/App.tsx", "src/App.jsx", "next.config.js", "next.config.ts"],
  vue: ["vue.config.js", "nuxt.config.js", "nuxt.config.ts", "vite.config.ts"],
  fullstack: ["next.config.js", "next.config.ts", "remix.config.js"],
  python: ["requirements.txt", "pyproject.toml", "setup.py"],
  django: ["manage.py"],
  fastapi: ["main.py", "app/main.py"],
  rust: ["Cargo.toml"],
  go: ["go.mod"]
};

export async function detectStack(projectRoot: string): Promise<Stack | null> {
  const packageDependencies = await readPackageDependencies(projectRoot);
  const pythonManifest = await readPythonManifest(projectRoot);
  const detected = new Set<Stack>();

  if (hasAnyDependency(packageDependencies, FULLSTACK_DEPENDENCIES) || (await hasAnySignal(projectRoot, SIGNALS.fullstack))) {
    detected.add("fullstack");
  }

  if (hasAnyDependency(packageDependencies, REACT_DEPENDENCIES) || (await hasAnySignal(projectRoot, SIGNALS.react))) {
    detected.add("react");
  }

  if (hasAnyDependency(packageDependencies, VUE_DEPENDENCIES) || (await hasAnySignal(projectRoot, SIGNALS.vue))) {
    detected.add("vue");
  }

  if (hasAnyDependency(packageDependencies, NODE_DEPENDENCIES) || (await hasAnySignal(projectRoot, SIGNALS.nodejs))) {
    detected.add("nodejs");
  }

  if ((await hasAnySignal(projectRoot, SIGNALS.django)) && hasPythonDependency(pythonManifest, "django")) {
    detected.add("django");
  }

  if (hasPythonDependency(pythonManifest, "fastapi") || (await hasAnySignal(projectRoot, SIGNALS.fastapi))) {
    detected.add("fastapi");
  }

  if (pythonManifest || (await hasAnySignal(projectRoot, SIGNALS.python))) {
    detected.add("python");
  }

  if (await hasAnySignal(projectRoot, SIGNALS.rust)) {
    detected.add("rust");
  }

  if (await hasAnySignal(projectRoot, SIGNALS.go)) {
    detected.add("go");
  }

  if (detected.has("django") || detected.has("fastapi")) {
    detected.delete("python");
  }

  if (detected.size === 0) {
    return null;
  }

  if (detected.has("fullstack") || detected.size > 1) {
    return "fullstack";
  }

  return [...detected][0];
}

async function readPackageDependencies(projectRoot: string): Promise<Set<string>> {
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    return new Set();
  }

  try {
    const pkg = await fs.readJson(packageJsonPath);
    return new Set(Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }));
  } catch {
    return new Set();
  }
}

async function readPythonManifest(projectRoot: string): Promise<string | null> {
  const files = ["requirements.txt", "pyproject.toml", "setup.py"];
  const contents: string[] = [];

  for (const file of files) {
    const filePath = path.join(projectRoot, file);
    if (await fs.pathExists(filePath)) {
      contents.push(await fs.readFile(filePath, "utf8"));
    }
  }

  return contents.length > 0 ? contents.join("\n").toLowerCase() : null;
}

function hasAnyDependency(actual: Set<string>, expected: Set<string>): boolean {
  return [...expected].some((dependency) => actual.has(dependency));
}

function hasPythonDependency(manifest: string | null, dependency: string): boolean {
  if (!manifest) {
    return false;
  }

  return new RegExp(`(^|[^a-z0-9_-])${dependency}([^a-z0-9_-]|$)`, "i").test(manifest);
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
