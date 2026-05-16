import path from "path";
import { describe, expect, it } from "vitest";
import { renderKiroSteering } from "../../src/compiler/kiro";
import { loadSkills } from "../../src/utils/skills";

const fixturesDir = path.resolve(__dirname, "..", "fixtures", "skills");

describe("renderKiroSteering", () => {
  it("renders Kiro steering content for fixture skills", async () => {
    const skills = await loadSkills(fixturesDir);
    const output = Object.fromEntries(skills.map((skill) => [skill.id, renderKiroSteering(skill)]));

    expect(output).toMatchSnapshot();
  });
});
