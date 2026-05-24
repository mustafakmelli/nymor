import { AgentTargetDefinition } from "../agents/targets";
import { SkillFile } from "../utils/skills";

const LEARN_TRIGGER = "/nymor-learn";

function getLearnArgumentsPlaceholder(target: AgentTargetDefinition): string {
  return target.id === "copilot" ? "{{input}}" : "$ARGUMENTS";
}

export function renderBootstrap(target: AgentTargetDefinition, skills: SkillFile[] = [], wrap = true): string {
  const body = [
    "# Nymor",
    "",
    "Nymor teaches this repo what AI agents keep forgetting.",
    "",
    "Source skills live in `.nymor/skills/`. Apply any matching skill during the task, using `globs` and `alwaysApply` to decide relevance.",
    "",
    "If the user states a durable repo rule, says things like \"always\", \"never\", \"in this repo\", \"we use\", \"remember this\", or corrects the same behavior more than once, gently suggest:",
    "",
    "`This looks like a reusable repo rule. Want me to capture it with /nymor-learn?`",
    "",
    `Only create a skill after the user explicitly invokes ${LEARN_TRIGGER}.`,
    "",
    `When the user invokes ${LEARN_TRIGGER} "<rule>":`,
    "",
    "1. Infer the durable rule from the conversation.",
    "2. Choose a stable lowercase folder id with hyphens.",
    "3. Read `nymor.json` and `.nymor/skills/`.",
    "4. Write `.nymor/skills/<id>/SKILL.md` directly.",
    "5. Include complete frontmatter: `name`, `description`, `globs`, and `alwaysApply`.",
    "6. If the rule forbids or prevents a coding pattern, add `forbiddenPatterns` as a regex array in the frontmatter.",
    "7. Include complete sections: `## Rule`, `## Why`, and `## Example`.",
    "8. Keep `globs` narrow unless the rule is genuinely global.",
    "9. Add `<id>` to `nymor.json.local` if missing.",
    "10. Run `nymor compile`.",
    "11. Run `nymor validate`.",
    "12. Report the captured rule and skill path.",
    "",
    "Never create placeholders. Write directly to the active skill path. Create only the requested skill; do not seed unrelated skills or use external installs.",
    "",
    renderAlwaysApplySection(skills)
  ].join("\n");

  return wrap ? wrapBootstrap(target, body) : body;
}

export function renderLearnCommand(target: AgentTargetDefinition): string {
  const inputPlaceholder = getLearnArgumentsPlaceholder(target);

  return [
    "---",
    "description: Capture a durable repo rule as a Nymor skill.",
    "---",
    "",
    `# ${target.label} Nymor Learn`,
    "",
    "User input:",
    "",
    "```text",
    inputPlaceholder,
    "```",
    "",
    renderBootstrap(target, [], false)
  ].join("\n");
}

export function renderLearnSkill(target: AgentTargetDefinition): string {
  return [
    "---",
    "name: Nymor Learn",
    "description: Capture durable repo rules as active Nymor skills.",
    "globs:",
    "  - \"**/*\"",
    "alwaysApply: true",
    "---",
    "",
    renderBootstrap(target, [], false)
  ].join("\n");
}

function wrapBootstrap(target: AgentTargetDefinition, body: string): string {
  if (target.id === "cursor") {
    return ["---", "description: Nymor repo-memory capture and skill guidance.", "globs:", "  - \"**/*\"", "alwaysApply: true", "---", "", body].join(
      "\n"
    );
  }

  if (target.id === "copilot") {
    return ["---", "applyTo: \"**/*\"", "---", "", body].join("\n");
  }

  if (target.id === "kiro") {
    return ["---", "inclusion: always", "---", "", body].join("\n");
  }

  return body;
}

function renderAlwaysApplySection(skills: SkillFile[]): string {
  const alwaysApply = skills.filter((skill) => skill.frontmatter.alwaysApply);
  if (alwaysApply.length === 0) {
    return "No always-apply Nymor skills are currently configured.";
  }

  return [
    "## Always-Apply Nymor Skills",
    "",
    ...alwaysApply.map((skill) => [`### ${skill.frontmatter.name}`, "", skill.body.trim()].join("\n")).join("\n\n---\n\n").split("\n")
  ].join("\n");
}
