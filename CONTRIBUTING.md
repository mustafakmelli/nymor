# Contributing to Nymor

Thanks for your interest in contributing. Nymor is a small, focused CLI — contributions that make it simpler and more useful are always welcome.

## Setup

```sh
git clone https://github.com/mustafakmelli/nymor.git
cd nymor
npm install
npm run build
npm test
```

## Project structure

```
src/
  commands/    CLI commands (sync, list, status, doctor, watch, learn, mcp)
  agents/      Agent target definitions
  compiler/    Per-agent output renderers (cursor, copilot, kiro, claude, block)
  detector/    Agent auto-detection
  templates/   Bootstrap templates and manifest defaults
  utils/       Shared utilities (skills, manifest, paths)

tests/
  e2e/         End-to-end CLI tests (run against built dist)
  compiler/    Unit tests for output renderers
  detector/    Unit tests for agent detection
  utils/       Unit tests for utilities
```

## Adding a new agent target

1. **Add the target definition** in [`src/agents/targets.ts`](src/agents/targets.ts):
   - Add the agent ID to the `AgentTarget` type union
   - Add the target definition to `AGENT_TARGETS` with `id`, `label`, `short`, `description`, `detectPaths`, `kind`, and optionally `bootstrapFile`, `commandFile`, `nativeSkillDir`

2. **Add a renderer** in `src/compiler/<agent>.ts` if the output format is unique. If it uses an existing kind (`shared-md`, `native-skills`), no new renderer is needed.

3. **Wire it in `compile.ts`** — add a `case` to `planTargetOutputs()` if you added a new `AgentOutputKind`.

4. **Add tests** — add a compiler unit test in `tests/compiler/`, and add the agent to the agents test in `tests/e2e/init-and-compile.test.ts`.

5. **Update the README** — add the agent to the supported agents table.

## Running tests

```sh
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run build && npm test # Full check (build + test)
```

The e2e tests build the project automatically before running. They create real temporary directories and run the CLI binary, so they test the actual compiled output.

## Code style

- TypeScript strict mode is enabled. No `any` unless absolutely necessary.
- Use `picocolors` (`pc`) for terminal color output — it's already a dependency.
- Keep commands thin — heavy logic goes in `utils/` or `compiler/`.
- No new runtime dependencies without a very good reason.

## PR guidelines

- Keep PRs focused. One feature or fix per PR.
- All tests must pass (`npm run build && npm test`).
- If you're adding an agent, verify that the output files are actually accepted by the agent — don't add targets based on guesses about file paths.
- Update the README if you're adding user-facing changes.

## Filing issues

Found a bug or have a feature idea? Open an issue. Please include:
- Your OS and Node version
- The command you ran
- The expected vs actual behavior
- Any relevant output from `nymor doctor`
