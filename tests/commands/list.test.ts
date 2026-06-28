import { describe, expect, it } from "vitest";
import { buildSkillUsageInsights } from "../../src/commands/list";
import { SkillIndexEntry } from "../../src/utils/skills";

describe("buildSkillUsageInsights", () => {
  const entries: SkillIndexEntry[] = [
    {
      id: "frontend",
      name: "Frontend",
      description: "Frontend rule",
      globs: ["src/**/*.tsx"],
      alwaysApply: false
    },
    {
      id: "global",
      name: "Global",
      description: "Global rule",
      globs: ["**/*"],
      alwaysApply: true
    },
    {
      id: "backend",
      name: "Backend",
      description: "Backend rule",
      globs: ["api/**/*.ts"],
      alwaysApply: false
    }
  ];

  it("matches skills against focused files and marks unused skills", () => {
    const insights = buildSkillUsageInsights(entries, ["src/components/Button.tsx"]);

    expect(insights).toEqual([
      {
        id: "frontend",
        alwaysApply: false,
        matchedFiles: ["src/components/Button.tsx"]
      },
      {
        id: "global",
        alwaysApply: true,
        matchedFiles: ["src/components/Button.tsx"]
      },
      {
        id: "backend",
        alwaysApply: false,
        matchedFiles: []
      }
    ]);
  });

  it("returns empty matches when focus is not provided", () => {
    const insights = buildSkillUsageInsights(entries, []);
    expect(insights.every((insight) => insight.matchedFiles.length === 0)).toBe(true);
  });
});
