import readline from "readline";
import fs from "fs-extra";
import path from "path";
import { minimatch } from "minimatch";
import { getSkillsDir } from "../utils/paths";
import { loadSkills } from "../utils/skills";

export async function mcpCommand(): Promise<void> {
  // Redirect console.log and console.warn to stderr so they don't corrupt the JSON-RPC channel on stdout
  const originalLog = console.log;
  console.log = (...args) => console.error(...args);
  console.warn = (...args) => console.error(...args);

  const projectRoot = process.cwd();
  const skillsDir = getSkillsDir(projectRoot);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);
      if (request.jsonrpc !== "2.0") {
        return;
      }

      // If it's a notification, ignore or handle without sending response
      if (request.id === undefined) {
        return;
      }

      const response = await handleMcpRequest(request, projectRoot, skillsDir);
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error parsing MCP request line: ${errMsg}\n`);
    }
  });

  process.stderr.write("Nymor MCP Server started successfully.\n");
}

export async function handleMcpRequest(
  request: any,
  projectRoot: string,
  skillsDir: string
): Promise<any> {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "nymor-mcp",
            version: "1.0.0"
          }
        }
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_skills",
              description: "Retrieve all active Nymor rules and skills defined in this repository.",
              inputSchema: {
                type: "object",
                properties: {}
              }
            },
            {
              name: "search_skills",
              description: "Search active Nymor skills. You can specify a filePath to fetch matching glob rules, or a text query to search rule bodies.",
              inputSchema: {
                type: "object",
                properties: {
                  filePath: {
                    type: "string",
                    description: "Relative file path (e.g. 'src/App.tsx') to find matched rules for."
                  },
                  query: {
                    type: "string",
                    description: "Search text query to match against rule descriptions or bodies."
                  }
                }
              }
            }
          ]
        }
      };

    case "tools/call": {
      const { name, arguments: args } = params || {};
      if (name === "get_skills") {
        try {
          const skills = await loadSkills(skillsDir);
          const formatted = formatSkillsResult(skills);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: formatted
                }
              ]
            }
          };
        } catch (err) {
          return mcpError(id, -32000, `Failed to load skills: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (name === "search_skills") {
        try {
          const { filePath, query } = args || {};
          let skills = await loadSkills(skillsDir);

          if (filePath) {
            skills = skills.filter((skill) => {
              if (skill.frontmatter.alwaysApply) {
                return true;
              }
              const globs = skill.frontmatter.globs || [];
              return globs.some((globPattern) => minimatch(filePath, globPattern, { dot: true, matchBase: true }));
            });
          }

          if (query) {
            const normalizedQuery = query.toLowerCase();
            skills = skills.filter(
              (skill) =>
                skill.frontmatter.name.toLowerCase().includes(normalizedQuery) ||
                (skill.frontmatter.description || "").toLowerCase().includes(normalizedQuery) ||
                skill.body.toLowerCase().includes(normalizedQuery)
            );
          }

          const formatted = formatSkillsResult(skills);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: formatted
                }
              ]
            }
          };
        } catch (err) {
          return mcpError(id, -32000, `Failed to search skills: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return mcpError(id, -32601, `Tool not found: ${name}`);
    }

    default:
      return mcpError(id, -32601, `Method not found: ${method}`);
  }
}

function formatSkillsResult(skills: any[]): string {
  if (skills.length === 0) {
    return "No Nymor skills matched your query.";
  }

  return skills
    .map((skill) => {
      const globs = skill.frontmatter.globs || [];
      const alwaysApply = skill.frontmatter.alwaysApply ? "Always" : "Glob-based";
      return [
        `### Skill: ${skill.frontmatter.name} (Folder: ${skill.id})`,
        `- **Description**: ${skill.frontmatter.description || "N/A"}`,
        `- **Relevance**: ${alwaysApply} (Globs: ${globs.join(", ") || "None"})`,
        "",
        skill.body.trim(),
        "---"
      ].join("\n");
    })
    .join("\n\n");
}

function mcpError(id: any, code: number, message: string): any {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}
