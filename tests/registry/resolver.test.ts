import { describe, expect, it } from "vitest";
import { resolveVersion, VersionNotFoundError } from "../../src/registry/resolver";

describe("resolveVersion", () => {
  const versions = ["1.0.0", "1.2.0", "1.2.5", "2.0.0"];

  it("resolves caret ranges to the highest matching major", () => {
    expect(resolveVersion("^1.0.0", versions)).toBe("1.2.5");
  });

  it("resolves tilde ranges to the highest matching minor", () => {
    expect(resolveVersion("~1.2.0", versions)).toBe("1.2.5");
  });

  it("resolves x ranges", () => {
    expect(resolveVersion("1.x", versions)).toBe("1.2.5");
  });

  it("resolves latest", () => {
    expect(resolveVersion("latest", versions)).toBe("2.0.0");
  });

  it("throws a typed error when nothing matches", () => {
    expect(() => resolveVersion("^3.0.0", versions)).toThrow(VersionNotFoundError);
  });
});
