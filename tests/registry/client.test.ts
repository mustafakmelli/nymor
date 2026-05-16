import http from "http";
import type { AddressInfo } from "net";
import os from "os";
import path from "path";
import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSkillTarball, fetchRootIndex, fetchSkillIndex, fetchSkillTarball } from "../../src/registry/client";

const registryRoot = path.resolve(__dirname, "..", "fixtures", "registry");

describe("registry client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fetches indexes and verifies tarball integrity", async () => {
    const server = await startRegistryServer(false);
    try {
      vi.stubEnv("CICADA_REGISTRY_URL", server.url);

      await expect(fetchRootIndex()).resolves.toMatchObject({ version: 1 });
      await expect(fetchSkillIndex("@cicada", "commit-conventions")).resolves.toMatchObject({
        name: "@cicada/commit-conventions",
        latest: "1.0.0"
      });

      const fetched = await fetchSkillTarball("@cicada", "commit-conventions", "1.0.0");
      expect(fetched.integrity).toMatch(/^sha256-/);

      const destination = await fs.mkdtemp(path.join(os.tmpdir(), "cicada-extract-"));
      await extractSkillTarball(fetched.tarball, destination);
      await expect(fs.pathExists(path.join(destination, "SKILL.md"))).resolves.toBe(true);
    } finally {
      await server.close();
    }
  });

  it("rejects tampered tarballs", async () => {
    const server = await startRegistryServer(true);
    try {
      vi.stubEnv("CICADA_REGISTRY_URL", server.url);

      await expect(fetchSkillTarball("@cicada", "commit-conventions", "1.0.0")).rejects.toThrow("Integrity mismatch");
    } finally {
      await server.close();
    }
  });
});

async function startRegistryServer(tamperTarball: boolean): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const filePath = path.join(registryRoot, requestPath);

    if (!filePath.startsWith(registryRoot)) {
      response.writeHead(403).end();
      return;
    }

    if (!(await fs.pathExists(filePath))) {
      response.writeHead(404).end();
      return;
    }

    const body = await fs.readFile(filePath);
    response.setHeader("Connection", "close");
    response.setHeader("Content-Length", tamperTarball && filePath.endsWith("SKILL.tar.gz") ? body.length + 6 : body.length);
    response.writeHead(200);
    response.end(tamperTarball && filePath.endsWith("SKILL.tar.gz") ? Buffer.concat([body, Buffer.from("tamper")]) : body);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}
