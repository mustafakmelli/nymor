```
███╗   ██╗██╗   ██╗███╗   ███╗ ██████╗ ██████╗
████╗  ██║╚██╗ ██╔╝████╗ ████║██╔═══██╗██╔══██╗
██╔██╗ ██║ ╚████╔╝ ██╔████╔██║██║   ██║██████╔╝
██║╚██╗██║  ╚██╔╝  ██║╚██╔╝██║██║   ██║██╔══██╗
██║ ╚████║   ██║   ██║ ╚═╝ ██║╚██████╔╝██║  ██║
╚═╝  ╚═══╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝
```

# Nymor

<p align="center">
  <strong>Teach your repo what your agents keep forgetting.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mustafakmelli/nymor"><img src="https://img.shields.io/npm/v/%40mustafakmelli%2Fnymor?color=black&label=npm" alt="npm version" /></a>
  <a href="https://github.com/mustafakmelli/nymor/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mustafakmelli/nymor?color=black" alt="license" /></a>
  <img src="https://img.shields.io/badge/zero-network_calls-black" alt="zero network" />
  <img src="https://img.shields.io/badge/agents-10_supported-black" alt="agents" />
</p>

---

You correct your agent. It forgets.  
You correct it again. It forgets again.  
You write the rule in a comment. The next chat starts fresh.

**Nymor stops that loop.**

When a rule is worth keeping, `/nymor-learn` captures it as a skill — committed to your repo, compiled into every agent surface, loaded in every future chat. The agent stops forgetting because the memory lives in the code.

---

## How it feels

```
You:    "We don't use API routes here. Always use Server Actions."
Agent:  "Got it. This looks like a durable repo rule —
         want me to capture it with /nymor-learn?"
You:    /nymor-learn "Use Server Actions for mutations, not API routes"
Agent:  Writing .nymor/skills/server-actions-only/SKILL.md ...
        Updating nymor.json ...
        Running nymor compile ...
        ✓ Skill saved and compiled to Claude, Cursor, Copilot, Kiro
```

Next chat. Same rule. Already known.

---

## Install

```sh
npm install -g nymor
```

Or run without installing:

```sh
npx nymor init
```

---

## Quick start

```sh
# Initialize repo memory and agent guidance
nymor init

# Then inside your agent (Cursor, Claude, Copilot, Kiro):
/nymor-learn "Use Server Actions for mutations, not API routes"

# See what your repo has learned
nymor list

# Recompile after manual edits
nymor compile
```

---

## The only workflow that matters

```
Correct agent  ──→  /nymor-learn  ──→  .nymor/skills/<id>/SKILL.md
                                              │
                          ┌───────────────────┼───────────────────┐
                          ↓                   ↓                   ↓
                    .claude/skills/     .cursor/rules/    .github/instructions/
                    CLAUDE.md           nymor.mdc         nymor-bootstrap.md
                          ↓                   ↓                   ↓
                    git commit ──────── git diff ──────── open PR
```

The agent writes the skill. Nymor compiles it. Git owns the history. Your team reviews it like any other change.

---

## Supported agents

| Agent                                                  | Output                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| Claude Code                                            | `.claude/skills/`, `CLAUDE.md`                 |
| Cursor                                                 | `.cursor/rules/nymor-*.mdc`                    |
| GitHub Copilot                                         | `.github/instructions/nymor-*.instructions.md`, `.github/prompts/nymor-learn.prompt.md` |
| Kiro                                                   | `.kiro/steering/nymor-*.md`                    |
| Codex, OpenCode, Aider, Goose, Zed, Warp, Devin, Junie | `AGENTS.md`                                    |
| Gemini CLI                                             | `GEMINI.md`                                    |
| Windsurf                                               | `.windsurf/rules/nymor.md`                     |
| Goose (native)                                         | `.goose/skills/`                               |
| OpenCode (native)                                      | `.opencode/skill/`                             |

---

## Skill format

Skills are plain Markdown. Human-readable, diffable, reviewable in a PR.

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

Keeps mutation logic close to the UI and preserves the repo's auth pattern.

## Example

// WRONG
export async function POST(req: Request) { ... } // app/api/users/route.ts

// CORRECT
'use server'
export async function updateUser(data: UserData) { ... } // app/users/actions.ts
```

---

## Commands

```sh
nymor init      # initialize repo memory, write /nymor-learn to all agents
nymor compile   # regenerate indexes and all agent outputs
nymor list      # list active repo skills
nymor doctor    # check manifest, globs, and generated outputs
nymor validate  # validate skill file structure
```

---

## What Nymor does not do

- **No central catalog.** Skills are yours. They live in your repo. There is nothing to install from the internet.
- **No LLM calls.** Nymor compiles and validates. The agent writes the skill. You review it.
- **No magic.** Every output is a plain file you can read, edit, delete, and commit.

---

## `nymor.json`

```json
{
  "version": "1",
  "agents": ["claude", "cursor", "copilot", "kiro", "agents-md"],
  "local": ["server-actions-only", "commit-conventions"]
}
```

---

## Generated files

```
.nymor/
  skills/
    server-actions-only/
      SKILL.md
  index.md
  index.json
nymor.json

CLAUDE.md                                          ← Claude bootstrap
.claude/commands/nymor-learn.md                    ← Claude slash command
.claude/skills/<id>/SKILL.md                       ← Claude native skills

.cursor/rules/nymor.mdc                            ← Cursor bootstrap
.cursor/rules/nymor-<id>.mdc                       ← Cursor per-skill
.cursor/commands/nymor-learn.md                    ← Cursor slash command

.github/instructions/nymor-bootstrap.instructions.md
.github/instructions/nymor-<id>.instructions.md
.github/prompts/nymor-learn.prompt.md                   ← Copilot slash command

.kiro/steering/nymor.md
.kiro/steering/nymor-<id>.md

AGENTS.md                                          ← Codex, Aider, Goose, etc.
GEMINI.md
.windsurf/rules/nymor.md
.goose/skills/<id>/SKILL.md
.opencode/skill/<id>/SKILL.md
```

---

## Development

```sh
npm run build
npm test
```

---

## Philosophy

> The agent is smart. Your repo is the memory.

Skills are not configuration. They are the accumulated knowledge of how your team works — decisions made, mistakes corrected, patterns established. Nymor makes that knowledge durable, reviewable, and portable across every agent your team uses.

Every `/nymor-learn` is a conversation turned into institutional memory.

Made for teams who want their agents to actually know how they work.
