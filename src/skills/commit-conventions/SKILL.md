---
name: Commit Conventions
description: Commit and branch naming rules to keep history consistent.
globs:
  - "**/*"
alwaysApply: true
---

# Skill: Commit Conventions

## Rule
Commits use: <type>(<scope>): <message>.
Types: feat, fix, chore, docs, refactor, test.
Branches use: <type>/<ticket>-<description>.

## Why
Consistent names make history searchable and reviews faster.

## Example
feat(auth): add JWT refresh token rotation
fix(user): handle missing profile edge case
branch: feat/CIC-42-cicada-init-command
