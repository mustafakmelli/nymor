import { describe, expect, it } from "vitest";
import { buildSkillIndex, parseSkillContent } from "../../src/utils/skills";

describe("parseSkillContent", () => {
  it("normalizes valid frontmatter", () => {
    const parsed = parseSkillContent(
      ["---", "name: Demo", "globs:", "  - src/**/*.ts", "alwaysApply: true", "---", "", "## Rule", "Use demos."].join("\n"),
      "demo"
    );

    expect(parsed.frontmatter).toEqual({
      name: "Demo",
      description: "",
      globs: ["src/**/*.ts"],
      alwaysApply: true
    });
    expect(parsed.body).toContain("## Rule");
  });

  it("throws when frontmatter is missing", () => {
    expect(() => parseSkillContent("## Rule", "missing")).toThrow("missing frontmatter");
  });

  it("throws when frontmatter is malformed", () => {
    expect(() => parseSkillContent(["---", "name: [", "---"].join("\n"), "bad")).toThrow();
  });

  it("throws when name is missing", () => {
    expect(() => parseSkillContent(["---", "description: nope", "---"].join("\n"), "bad")).toThrow("missing a name");
  });
});

describe("buildSkillIndex", () => {
  it("renders markdown and json entries", () => {
    const index = buildSkillIndex([
      {
        id: "demo",
        dirPath: "/tmp/demo",
        skillPath: "/tmp/demo/SKILL.md",
        frontmatter: { name: "Demo", description: "Desc", globs: ["src/**/*.ts"], alwaysApply: false },
        body: "body",
        raw: "raw"
      }
    ]);

    expect(index.markdown).toContain("| Demo | demo | Desc | src/**/*.ts | no |");
    expect(JSON.parse(index.json).skills[0].id).toBe("demo");
  });
});
