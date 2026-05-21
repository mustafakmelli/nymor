import path from "path";

export type AgentTarget =
  | "claude"
  | "cursor"
  | "copilot"
  | "kiro"
  | "agents-md"
  | "gemini"
  | "windsurf"
  | "goose"
  | "opencode"
  | "cline"
  | "cody"
  | "tabnine"
  | "codewhisperer"
  | "jetbrains"
  | "replit"
  | "zed";

export type AgentOutputKind =
  | "claude"
  | "cursor"
  | "copilot"
  | "kiro"
  | "shared-md"
  | "gemini"
  | "windsurf"
  | "native-skills"
  | "cline"
  | "cody"
  | "tabnine"
  | "codewhisperer"
  | "jetbrains"
  | "replit"
  | "zed";

export interface AgentTargetDefinition {
  id: AgentTarget;
  label: string;
  short: string;
  description: string;
  detectPaths: string[];
  kind: AgentOutputKind;
  bootstrapFile?: string;
  commandFile?: string;
  nativeSkillDir?: string;
  sharedConsumers?: string[];
}

export const AGENT_TARGETS: AgentTargetDefinition[] = [
  {
    id: "claude",
    label: "Claude Code",
    short: "Claude",
    description: "Claude skills, CLAUDE.md bootstrap, and /nymor-learn command",
    detectPaths: [".claude", "CLAUDE.md"],
    kind: "claude",
    bootstrapFile: "CLAUDE.md",
    commandFile: path.join(".claude", "commands", "nymor-learn.md")
  },
  {
    id: "cursor",
    label: "Cursor",
    short: "Cursor",
    description: "Cursor rules and /nymor-learn command",
    detectPaths: [".cursor"],
    kind: "cursor",
    bootstrapFile: path.join(".cursor", "rules", "nymor.mdc"),
    commandFile: path.join(".cursor", "commands", "nymor-learn.md")
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    short: "Copilot",
    description: "GitHub Copilot instructions and /nymor-learn prompt",
    detectPaths: [
      path.join(".github", "copilot-instructions.md"),
      path.join(".github", "instructions"),
      path.join(".github", "prompts")
    ],
    kind: "copilot",
    bootstrapFile: path.join(".github", "instructions", "nymor-bootstrap.instructions.md"),
    commandFile: path.join(".github", "prompts", "nymor-learn.prompt.md")
  },
  {
    id: "kiro",
    label: "Kiro",
    short: "Kiro",
    description: "Kiro steering files",
    detectPaths: [".kiro"],
    kind: "kiro",
    bootstrapFile: path.join(".kiro", "steering", "nymor.md")
  },
  {
    id: "agents-md",
    label: "AGENTS.md",
    short: "AGENTS.md",
    description: "Shared AGENTS.md for Codex, OpenCode, Aider, Goose, Zed, Warp, Devin, and Junie",
    detectPaths: ["AGENTS.md", ".codex", ".aider.conf.yml", ".zed", ".warp", ".junie", ".goose", ".opencode"],
    kind: "shared-md",
    bootstrapFile: "AGENTS.md",
    sharedConsumers: ["Codex", "OpenCode", "Aider", "Goose", "Zed", "Warp", "Devin", "Junie"]
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    short: "Gemini",
    description: "GEMINI.md managed block",
    detectPaths: ["GEMINI.md", ".gemini"],
    kind: "gemini",
    bootstrapFile: "GEMINI.md"
  },
  {
    id: "windsurf",
    label: "Windsurf",
    short: "Windsurf",
    description: "Windsurf project rule file",
    detectPaths: [".windsurf", ".windsurfrules"],
    kind: "windsurf",
    bootstrapFile: path.join(".windsurf", "rules", "nymor.md")
  },
  {
    id: "goose",
    label: "Goose",
    short: "Goose",
    description: "Goose native skills",
    detectPaths: [".goose"],
    kind: "native-skills",
    nativeSkillDir: path.join(".goose", "skills")
  },
  {
    id: "opencode",
    label: "OpenCode",
    short: "OpenCode",
    description: "OpenCode native skills",
    detectPaths: [".opencode", "opencode.json"],
    kind: "native-skills",
    nativeSkillDir: path.join(".opencode", "skill")
  },
  {
    id: "cline",
    label: "Cline",
    short: "Cline",
    description: "Cline rules and custom instructions",
    detectPaths: [".cline", "CLINE.md"],
    kind: "cline",
    bootstrapFile: path.join(".cline", "rules", "nymor.md")
  },
  {
    id: "cody",
    label: "Sourcegraph Cody",
    short: "Cody",
    description: "Cody custom instructions",
    detectPaths: [".cody", "CODY.md", "cody.json"],
    kind: "cody",
    bootstrapFile: path.join(".cody", "instructions", "nymor.md")
  },
  {
    id: "tabnine",
    label: "Tabnine",
    short: "Tabnine",
    description: "Tabnine custom instructions",
    detectPaths: [".tabnine", "tabnine.json"],
    kind: "tabnine",
    bootstrapFile: path.join(".tabnine", "instructions", "nymor.md")
  },
  {
    id: "codewhisperer",
    label: "Amazon CodeWhisperer",
    short: "CodeWhisperer",
    description: "Amazon CodeWhisperer custom guidance",
    detectPaths: [".aws", "CODEWHISPERER.md"],
    kind: "codewhisperer",
    bootstrapFile: "CODEWHISPERER.md"
  },
  {
    id: "jetbrains",
    label: "JetBrains AI Assistant",
    short: "JetBrains",
    description: "JetBrains AI Assistant custom instructions",
    detectPaths: [".idea", "JETBRAINS.md"],
    kind: "jetbrains",
    bootstrapFile: path.join(".idea", "ai-assistant", "nymor.md")
  },
  {
    id: "replit",
    label: "Replit AI",
    short: "Replit",
    description: "Replit AI custom instructions",
    detectPaths: [".replit", "REPLIT.md"],
    kind: "replit",
    bootstrapFile: path.join(".replit", "ai-instructions", "nymor.md")
  },
  {
    id: "zed",
    label: "Zed AI",
    short: "Zed",
    description: "Zed AI custom instructions",
    detectPaths: [".zed", "ZED.md"],
    kind: "zed",
    bootstrapFile: path.join(".zed", "ai-rules", "nymor.md")
  }
];

export const DEFAULT_AGENT_TARGETS: AgentTarget[] = ["claude", "cursor", "copilot", "kiro", "agents-md"];

export function getAgentTargetDefinition(id: AgentTarget): AgentTargetDefinition {
  const target = AGENT_TARGETS.find((item) => item.id === id);
  if (!target) {
    throw new Error(`Unknown agent target: ${id}`);
  }
  return target;
}

export function isAgentTarget(value: string): value is AgentTarget {
  return AGENT_TARGETS.some((target) => target.id === value);
}
