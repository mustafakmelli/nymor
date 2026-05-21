#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { compileCommand } from "./commands/compile";
import { learnCommand } from "./commands/learn";
import { listCommand } from "./commands/list";
import { doctorCommand } from "./commands/doctor";
import { validateCommand } from "./commands/validate";
import { lintCommand } from "./commands/lint";
import { mineCommand } from "./commands/mine";
import { importCommand } from "./commands/import";
import { mcpCommand } from "./commands/mcp";

const program = new Command();

program
  .name("nymor")
  .description("Teach your repo what your AI agents keep forgetting")
  .version("2.0.0");

program
  .command("init")
  .description("Initialize Nymor in the current repo")
  .action(() => initCommand());

program
  .command("compile")
  .description("Compile skills to agent surfaces")
  .option("--focus <files...>", "Focus compilation on a list of files")
  .option("--git", "Focus compilation on files modified in Git")
  .action((options) => compileCommand(options));

program
  .command("learn", { hidden: true })
  .argument("<rule>", "One-line rule or convention to capture")
  .option("--id <id>", "Local skill folder id")
  .option("--name <name>", "Skill name")
  .option("--description <description>", "Skill description")
  .option("--globs <globs>", "Comma-separated file globs")
  .option("--always-apply", "Apply the skill regardless of globs")
  .option("--why <why>", "Why this rule matters")
  .option("--example <example>", "Example or counter-example")
  .description("Internal fallback for capturing a project rule as a local skill")
  .action((rule, options) => learnCommand(rule, options));

program
  .command("list")
  .description("List active repo skills")
  .action(() => listCommand());

program
  .command("doctor")
  .description("Check skills for common issues")
  .action(() => doctorCommand());

program
  .command("validate")
  .description("Validate skill file format and index entries")
  .action(() => validateCommand());

program
  .command("lint")
  .description("Lint codebase against forbidden patterns in skills")
  .action(() => lintCommand());

program
  .command("mine")
  .description("Scan repository for inline skill comments")
  .action(() => mineCommand());

program
  .command("import")
  .description("Import rules from existing systems (e.g. Cursor)")
  .option("--from-cursor", "Import from .cursorrules and .cursor/rules/*.mdc")
  .action((options) => importCommand(options));

program
  .command("mcp")
  .description("Start Nymor MCP Server over stdin/stdout")
  .action(() => mcpCommand());

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
