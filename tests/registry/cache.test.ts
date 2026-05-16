import os from "os";
import path from "path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedIndex, getCachedTarball, putCachedIndex, putCachedTarball } from "../../src/registry/cache";

describe("registry cache", () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-cache-home-"));
    vi.stubEnv("HOME", home);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("roundtrips tarballs and integrity files", async () => {
    const tarball = Buffer.from("tarball");

    await putCachedTarball("@cicada", "demo", "1.0.0", tarball, "sha256-demo");

    await expect(getCachedTarball("@cicada", "demo", "1.0.0")).resolves.toEqual(tarball);
    await expect(
      fs.readFile(path.join(home, ".cicada", "cache", "skills", "@cicada__demo", "1.0.0", "integrity.txt"), "utf8")
    ).resolves.toBe("sha256-demo\n");
  });

  it("roundtrips cached indexes with TTL", async () => {
    await putCachedIndex("@cicada__demo", { latest: "1.0.0" });

    await expect(getCachedIndex("@cicada__demo", 60_000)).resolves.toEqual({ latest: "1.0.0" });
    await expect(getCachedIndex("@cicada__demo", -1)).resolves.toBeNull();
  });
});
