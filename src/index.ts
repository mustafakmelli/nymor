#!/usr/bin/env node
import { Command } from "commander";
import { syncCommand } from "./commands/sync";
import { listCommand } from "./commands/list";
import { statusCommand } from "./commands/status";
import { doctorCommand } from "./commands/doctor";
import { watchCommand } from "./commands/watch";
import { learnCommand } from "./commands/learn";
import { mcpCommand } from "./commands/mcp";

const packageJson = require("../package.json") as { version: string };

const program = new Command();

program
  .name("nymor")
  .description("Sync your AI agent rules everywhere — one command, all agents")
  .version(packageJson.version);

program
  .command("sync")
  .description("Sync skills to all agent surfaces")
  .option("--dry-run", "Show what would change without writing any files")
  .option("--agents <agents...>", "Override auto-detected agents (e.g. claude cursor copilot)")
  .option("--force", "Re-import existing rules even if already initialized")
  .action((options) => syncCommand(options));

program
  .command("list")
  .description("List active repo skills")
  .action(() => listCommand());

program
  .command("status")
  .description("Show sync state and stale outputs")
  .action(() => statusCommand());

program
  .command("doctor")
  .description("Check skills for common issues")
  .action(() => doctorCommand());

program
  .command("watch")
  .description("Watch skills and auto-sync on changes")
  .action(() => watchCommand());

program
  .command("mcp")
  .description("Start Nymor MCP Server over stdin/stdout")
  .action(() => mcpCommand());

// Hidden: used by AI agents via /nymor-learn, not intended for direct use
program
  .command("learn", { hidden: true })
  .description("Capture a repo rule as a skill (invoked by agents via /nymor-learn)")
  .argument("<rule>", "One-line rule or convention to capture")
  .option("--id <id>", "Skill folder id")
  .option("--name <name>", "Skill name")
  .option("--description <description>", "Skill description")
  .option("--globs <globs>", "Comma-separated file globs")
  .option("--always-apply", "Apply skill regardless of file globs")
  .option("--why <why>", "Why this rule matters")
  .option("--example <example>", "Example or counter-example")
  .action((rule, options) => learnCommand(rule, options));

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
