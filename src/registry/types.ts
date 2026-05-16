export interface RegistryRootIndex {
  version: 1;
  skills: Record<string, { latest: string; description?: string; tags?: string[] }>;
}

export interface SkillRegistryIndex {
  name: string;
  description?: string;
  versions: Record<string, { integrity: string; publishedAt: string }>;
  latest: string;
}
