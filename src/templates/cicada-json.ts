export interface CicadaManifestTemplate {
  version: string;
  agents: string[];
  skills: Record<string, string>;
  local: string[];
}

export function createDefaultManifest(): CicadaManifestTemplate {
  return {
    version: "1",
    agents: ["claude", "cursor", "copilot", "kiro", "agents-md"],
    skills: {},
    local: []
  };
}
