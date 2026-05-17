import path from "path";
import os from "os";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { detectStack, Stack } from "../../src/detector/stack";

const fixturesRoot = path.resolve(__dirname, "..", "fixtures", "stacks");

describe("detectStack", () => {
  const cases: Array<[string, Stack]> = [
    ["nodejs", "nodejs"],
    ["react", "react"],
    ["vue", "vue"],
    ["django", "django"],
    ["fastapi", "fastapi"],
    ["rust", "rust"],
    ["go", "go"]
  ];

  it.each(cases)("detects %s", async (fixture, expected) => {
    await expect(detectStack(path.join(fixturesRoot, fixture))).resolves.toBe(expected);
  });

  it("returns null when no stack signals are present", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-stack-"));

    await expect(detectStack(projectRoot)).resolves.toBeNull();
  });
});
