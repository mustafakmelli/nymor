import os from "os";
import path from "path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { filterSkills } from "../../src/commands/compile";
import { handleMcpRequest } from "../../src/commands/mcp";
import { SkillFile } from "../../src/utils/skills";

describe("Nymor Core Enhancements", () => {
  describe("Feature A: Context-Aware Compilation (filterSkills)", () => {
    const mockSkills: SkillFile[] = [
      {
        id: "react-rule",
        dirPath: "/tmp/react-rule",
        skillPath: "/tmp/react-rule/SKILL.md",
        frontmatter: { name: "React Rule", globs: ["src/**/*.tsx"], alwaysApply: false },
        body: "React instructions",
        raw: "raw"
      },
      {
        id: "python-rule",
        dirPath: "/tmp/python-rule",
        skillPath: "/tmp/python-rule/SKILL.md",
        frontmatter: { name: "Python Rule", globs: ["**/*.py"], alwaysApply: false },
        body: "Python instructions",
        raw: "raw"
      },
      {
        id: "global-rule",
        dirPath: "/tmp/global-rule",
        skillPath: "/tmp/global-rule/SKILL.md",
        frontmatter: { name: "Global Rule", globs: ["**/*"], alwaysApply: true },
        body: "Global instructions",
        raw: "raw"
      }
    ];

    it("returns all skills if no focus is provided", () => {
      const active = filterSkills(mockSkills, []);
      expect(active).toHaveLength(3);
    });

    it("filters skills correctly based on focused file paths", () => {
      const activeReact = filterSkills(mockSkills, ["src/components/Button.tsx"]);
      expect(activeReact.map((s) => s.id)).toEqual(["react-rule", "global-rule"]);

      const activePython = filterSkills(mockSkills, ["app/main.py"]);
      expect(activePython.map((s) => s.id)).toEqual(["python-rule", "global-rule"]);

      const activeNone = filterSkills(mockSkills, ["README.md"]);
      expect(activeNone.map((s) => s.id)).toEqual(["global-rule"]);
    });
  });

  describe("Feature E: Model Context Protocol (MCP Request Handling)", () => {
    it("handles initialize request", async () => {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: 1, method: "initialize" },
        "/tmp",
        "/tmp/.nymor/skills"
      );
      expect(response.result.serverInfo.name).toBe("nymor-mcp");
    });

    it("handles tools/list request", async () => {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        "/tmp",
        "/tmp/.nymor/skills"
      );
      expect(response.result.tools).toHaveLength(2);
      expect(response.result.tools[0].name).toBe("get_skills");
      expect(response.result.tools[1].name).toBe("search_skills");
    });

    it("handles tools/call get_skills gracefully when directory is missing", async () => {
      const response = await handleMcpRequest(
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_skills" } },
        "/tmp",
        "/tmp/non-existent-skills-dir"
      );
      expect(response.result.content[0].text).toContain("No Nymor skills matched");
    });
  });
});
