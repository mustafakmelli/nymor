#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { compileCommand } from "./commands/compile";
import { learnCommand } from "./commands/learn";
import { listCommand } from "./commands/list";
import { doctorCommand } from "./commands/doctor";
import { validateCommand } from "./commands/validate";

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
  .action(() => compileCommand());

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

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
