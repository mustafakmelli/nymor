import path from "path";
import { describe, expect, it } from "vitest";
import { renderCopilotInstructions } from "../../src/compiler/copilot";
import { loadSkills } from "../../src/utils/skills";

const fixturesDir = path.resolve(__dirname, "..", "fixtures", "skills");

describe("renderCopilotInstructions", () => {
  it("renders GitHub instruction content for fixture skills", async () => {
    const skills = await loadSkills(fixturesDir);
    const output = Object.fromEntries(skills.map((skill) => [skill.id, renderCopilotInstructions(skill)]));

    expect(output).toMatchSnapshot();
  });
});
