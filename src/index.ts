#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { removeCommand } from "./commands/remove";
import { updateCommand } from "./commands/update";
import { compileCommand } from "./commands/compile";
import { learnCommand } from "./commands/learn";
import { listCommand } from "./commands/list";
import { doctorCommand } from "./commands/doctor";
import { validateCommand } from "./commands/validate";

const program = new Command();

program
  .name("cicada")
  .description("Local-first package manager for AI agent skills")
  .version("2.0.0");

program
  .command("init")
  .description("Initialize Cicada in the current repo")
  .action(() => initCommand());

program
  .command("add")
  .argument("<skill>", "Skill package to install")
  .option("-v, --version <version>", "Version range to install")
  .description("Install a skill from the registry")
  .action((skill, options) => addCommand(skill, options));

program
  .command("remove")
  .argument("<skill>", "Skill package to remove")
  .description("Remove an installed skill")
  .action((skill) => removeCommand(skill));

program
  .command("update")
  .argument("[skill]", "Skill package to update")
  .description("Update skills within version ranges")
  .action((skill) => updateCommand(skill));

program
  .command("compile")
  .description("Compile skills to agent surfaces")
  .action(() => compileCommand());

program
  .command("learn")
  .argument("<rule>", "One-line rule or convention to capture")
  .description("Scaffold a new local skill")
  .action((rule) => learnCommand(rule));

program
  .command("list")
  .description("List installed skills")
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
