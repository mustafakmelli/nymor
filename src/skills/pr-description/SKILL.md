---
name: PR Description
description: Standard PR sections that explain the why and risk.
globs:
  - "**/*"
alwaysApply: true
---

# Skill: PR Description

## Rule
Every PR description includes: Summary, Why, Testing, and Risk.

## Why
Reviewers should understand intent and impact without chasing context.

## Example
Summary: Add token refresh endpoint
Why: Prevent session churn for mobile clients
Testing: Unit + integration
Risk: Medium (auth flow)
