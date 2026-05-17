import { DEFAULT_AGENT_TARGETS } from "../agents/targets";

export interface NymorManifestTemplate {
  version: string;
  agents: string[];
  local: string[];
}

export function createDefaultManifest(): NymorManifestTemplate {
  return {
    version: "1",
    agents: [...DEFAULT_AGENT_TARGETS],
    local: []
  };
}
