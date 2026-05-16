import path from "path";
import { describe, expect, it } from "vitest";
import { renderAgentsMarkdown } from "../../src/compiler/agentsmd";
import { loadSkills } from "../../src/utils/skills";

const fixturesDir = path.resolve(__dirname, "..", "fixtures", "skills");

describe("renderAgentsMarkdown", () => {
  it("renders only always-apply skills", async () => {
    const skills = await loadSkills(fixturesDir);

    expect(renderAgentsMarkdown(skills)).toMatchSnapshot();
  });
});
