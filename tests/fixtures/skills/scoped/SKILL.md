---
name: Scoped Skill
description: Applies to TypeScript source files.
globs:
  - "src/**/*.ts"
alwaysApply: false
---

# Skill: Scoped Skill

## Rule
Use explicit return types on exported functions.

## Why
Exported APIs should be clear at the boundary.

## Example
export function run(): void {}
