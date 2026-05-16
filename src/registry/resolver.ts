import semver from "semver";

export class VersionNotFoundError extends Error {
  constructor(spec: string, availableVersions: string[]) {
    super(`No version found for range "${spec}" (available: ${availableVersions.join(", ") || "none"})`);
    this.name = "VersionNotFoundError";
  }
}

export function resolveVersion(spec: string, availableVersions: string[]): string {
  const versions = availableVersions.filter((version) => semver.valid(version)).sort(semver.rcompare);
  if (versions.length === 0) {
    throw new VersionNotFoundError(spec, availableVersions);
  }

  if (spec === "latest") {
    return versions[0];
  }

  const max = semver.maxSatisfying(versions, spec);
  if (!max) {
    throw new VersionNotFoundError(spec, availableVersions);
  }

  return max;
}
