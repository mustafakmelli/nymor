import path from "path";
import { describe, expect, it } from "vitest";
import { renderCursorRule } from "../../src/compiler/cursor";
import { loadSkills } from "../../src/utils/skills";

const fixturesDir = path.resolve(__dirname, "..", "fixtures", "skills");

describe("renderCursorRule", () => {
  it("renders .mdc rule content for fixture skills", async () => {
    const skills = await loadSkills(fixturesDir);
    const output = Object.fromEntries(skills.map((skill) => [skill.id, renderCursorRule(skill)]));

    expect(output).toMatchSnapshot();
  });
});
