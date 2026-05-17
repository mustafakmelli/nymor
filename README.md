# Nymor

Teach your repo what your agents keep forgetting.

Nymor is a local-first memory layer for AI coding agents. When you correct an agent with a rule that should last, Nymor turns that rule into a repo-owned skill and compiles it into the instruction surfaces your agents already read.

## Why

AI agents are good at the task in front of them and forgetful about the habits of your repo. You say "we do not use API routes here" once, then again tomorrow, then again in review. Nymor makes that correction durable.

## Quick Start

```sh
npm install
npm run build
node dist/index.js init
```

Then in your agent:

```text
/nymor-learn "Use Server Actions for mutations, not API routes"
```

The agent writes a complete skill into `.nymor/skills/`, updates `nymor.json`, runs `nymor compile`, and validates the result.

## How It Works

1. You correct an agent or name a repo convention.
2. The agent gently suggests `/nymor-learn` when the rule looks reusable.
3. The agent writes `.nymor/skills/<id>/SKILL.md`.
4. Nymor compiles the skill to your selected agent surfaces.
5. You commit the memory with the rest of the repo.

## Supported Agents

Nymor supports the common coding-agent surfaces teams use today:

- Claude Code
- Cursor
- GitHub Copilot
- Kiro
- AGENTS.md consumers, including Codex, OpenCode, Aider, Goose, Zed, Warp, Devin, and Junie
- Gemini CLI
- Windsurf
- Goose native skills
- OpenCode native skills

## Skill Format

Skills are Markdown files stored in `.nymor/skills/<skill-id>/SKILL.md`.

```md
---
name: Server Actions Only
description: Use this when changing application mutations.
globs:
  - "app/**/*.ts"
  - "app/**/*.tsx"
alwaysApply: false
---

# Skill: Server Actions Only

## Rule
Use Server Actions for mutations. Do not create API routes for app mutations.

## Why
This keeps mutation logic close to the UI and preserves the repo's auth pattern.

## Example
Prefer an exported action with `'use server'` over a new route handler.
```

## Commands

```sh
nymor init      # initialize repo memory and agent guidance
nymor compile   # regenerate indexes and agent outputs
nymor list      # list active repo skills
nymor doctor    # check manifest, skill globs, and generated outputs
nymor validate  # validate skill file structure
```

## Generated Files

Nymor keeps source memory in:

```text
.nymor/skills/
.nymor/index.md
.nymor/index.json
nymor.json
```

Depending on selected agents, Nymor also writes files such as:

```text
CLAUDE.md
.claude/commands/nymor-learn.md
.claude/skills/<skill-id>/SKILL.md
.cursor/rules/nymor.mdc
.cursor/rules/nymor-<skill-id>.mdc
.cursor/commands/nymor-learn.md
.github/instructions/nymor-bootstrap.instructions.md
.github/instructions/nymor-<skill-id>.instructions.md
.kiro/steering/nymor.md
.kiro/steering/nymor-<skill-id>.md
AGENTS.md
GEMINI.md
.windsurf/rules/nymor.md
.goose/skills/<skill-id>/SKILL.md
.opencode/skill/<skill-id>/SKILL.md
```

## Development

```sh
npm run build
npm test
```
