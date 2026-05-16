---
name: Cicada Learn Protocol
description: How agents should capture a new skill during /cicada-learn.
globs:
  - "**/*"
alwaysApply: true
---

# Skill: Cicada Learn Protocol

## Rule
When the user runs /cicada-learn, draft a new SKILL.md with frontmatter
(name, description, globs, alwaysApply) and save it under .cicada/skills/<skill>/SKILL.md.
Then re-run cicada compile.

## Why
Skills should be captured at the moment a rule is discovered, not after the fact.

## Example
---
name: Server Actions Only
description: Use Server Actions for mutations.
globs:
  - "app/**/*.ts"
  - "app/**/*.tsx"
alwaysApply: false
---

# Skill: Server Actions Only
## Rule
Use Server Actions for all mutations. Do not create API routes.
## Why
Keeps mutations close to UI and simplifies auth.
## Example
// export async function updateUser() { 'use server'; ... }
