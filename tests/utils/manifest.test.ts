import os from "os";
import path from "path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_TARGETS } from "../../src/agents/targets";
import { readManifest, writeManifest } from "../../src/utils/manifest";

describe("manifest utilities", () => {
  it("returns defaults when nymor.json is missing", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-manifest-"));

    await expect(readManifest(projectRoot)).resolves.toMatchObject({
      version: "1",
      agents: DEFAULT_AGENT_TARGETS,
      local: []
    });
  });

  it("roundtrips manifest JSON", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nymor-manifest-"));
    const manifest = {
      version: "1",
      agents: ["claude" as const],
      local: ["local-demo"]
    };

    await writeManifest(projectRoot, manifest);

    await expect(readManifest(projectRoot)).resolves.toEqual(manifest);
  });
});
