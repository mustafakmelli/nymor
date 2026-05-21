import { AgentTarget } from "./targets";

/**
 * Per-agent tuning allows skill authors to customize how a skill is compiled
 * for each agent target. An agent can specify:
 *  - priority: "high" | "medium" | "low" — affects ordering in agent contexts
 *  - format: "verbose" | "concise" — controls output verbosity
 *  - maxTokens: number — optional token limit hint for the agent
 */

export type AgentTuningPriority = "high" | "medium" | "low";
export type AgentTuningFormat = "verbose" | "concise";

export interface AgentTuning {
  priority?: AgentTuningPriority;
  format?: AgentTuningFormat;
  maxTokens?: number;
}

/**
 * Per-agent tuning map.
 * Key is the agent target id (claude, cursor, copilot, etc.)
 * Value is the tuning configuration for that agent.
 *
 * Example:
 * agents:
 *   claude: { priority: high, format: verbose }
 *   cursor: { format: concise }
 *   copilot: { maxTokens: 500 }
 */
export type AgentTuningMap = Partial<Record<AgentTarget, AgentTuning>>;

export const DEFAULT_AGENT_TUNING: AgentTuning = {
  priority: "medium",
  format: "verbose"
};

export function resolveAgentTuning(
  tuningMap: AgentTuningMap | undefined,
  agentId: AgentTarget
): AgentTuning {
  return {
    ...DEFAULT_AGENT_TUNING,
    ...(tuningMap?.[agentId] ?? {})
  };
}

export function validateAgentTuning(
  tuningMap: unknown
): { valid: true } | { valid: false; errors: string[] } {
  if (tuningMap === undefined || tuningMap === null) {
    return { valid: true };
  }

  if (typeof tuningMap !== "object" || Array.isArray(tuningMap)) {
    return { valid: false, errors: ["agents tuning must be an object mapping agent ids to tuning configs"] };
  }

  const errors: string[] = [];
  const validPriorities = new Set<string>(["high", "medium", "low"]);
  const validFormats = new Set<string>(["verbose", "concise"]);
  const validAgentIds = new Set<string>([
    "claude", "cursor", "copilot", "kiro", "agents-md", "gemini",
    "windsurf", "goose", "opencode", "cline", "cody", "tabnine",
    "codewhisperer", "jetbrains", "replit", "zed"
  ]);

  const map = tuningMap as Record<string, unknown>;

  for (const [agentId, tuning] of Object.entries(map)) {
    if (!validAgentIds.has(agentId)) {
      errors.push(`unknown agent id "${agentId}" in agents tuning`);
      continue;
    }

    if (tuning === undefined || tuning === null) {
      continue;
    }

    if (typeof tuning !== "object" || Array.isArray(tuning)) {
      errors.push(`agents.${agentId} must be an object with optional priority, format, and maxTokens`);
      continue;
    }

    const t = tuning as Record<string, unknown>;

    if (t.priority !== undefined && !validPriorities.has(String(t.priority))) {
      errors.push(`agents.${agentId}.priority must be one of: high, medium, low`);
    }

    if (t.format !== undefined && !validFormats.has(String(t.format))) {
      errors.push(`agents.${agentId}.format must be one of: verbose, concise`);
    }

    if (t.maxTokens !== undefined && (typeof t.maxTokens !== "number" || t.maxTokens <= 0)) {
      errors.push(`agents.${agentId}.maxTokens must be a positive integer`);
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
