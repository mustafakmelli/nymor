import os from "os";
import path from "path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { readLockfile, readManifest, writeLockfile, writeManifest } from "../../src/utils/manifest";

describe("manifest utilities", () => {
  it("returns defaults when cicada.json is missing", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-manifest-"));

    await expect(readManifest(projectRoot)).resolves.toMatchObject({
      version: "1",
      agents: ["claude", "cursor", "copilot", "kiro", "agents-md"],
      skills: {},
      local: []
    });
  });

  it("roundtrips manifest and lockfile JSON", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-manifest-"));
    const manifest = {
      version: "1",
      agents: ["claude" as const],
      skills: { "@cicada/demo": "^1.0.0" },
      local: ["local-demo"]
    };
    const lockfile = {
      lockfileVersion: 1,
      skills: {
        "@cicada/demo": {
          version: "1.0.0",
          integrity: "sha256-demo",
          resolved: "https://example.test/demo.tgz"
        }
      }
    };

    await writeManifest(projectRoot, manifest);
    await writeLockfile(projectRoot, lockfile);

    await expect(readManifest(projectRoot)).resolves.toEqual(manifest);
    await expect(readLockfile(projectRoot)).resolves.toEqual(lockfile);
  });
});
