#!/bin/bash
# Nymor demo recording script

# Clean any previous nymor state (keep .github/copilot-instructions.md)
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.nymor
rm -f /Users/mostafamilly/Documents/Projects/full-stack-demo/nymor.json
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.claude
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.cursor
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.github/instructions
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.github/prompts
rm -rf /Users/mostafamilly/Documents/Projects/full-stack-demo/.kiro
rm -f /Users/mostafamilly/Documents/Projects/full-stack-demo/CLAUDE.md
rm -f /Users/mostafamilly/Documents/Projects/full-stack-demo/AGENTS.md
rm -f /Users/mostafamilly/Documents/Projects/full-stack-demo/GEMINI.md

# ── Colors ──────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[1;35m'

# Simulate typing with colored text
simulate_typing() {
  local color="$1"
  local text="$2"
  printf "${color}"
  for (( i=0; i<${#text}; i++ )); do
    printf '%s' "${text:$i:1}"
    sleep 0.04
  done
  printf "${RESET}"
}

prompt() {
  printf "\n${GREEN}❯${RESET} "
}

comment() {
  printf "\n${DIM}  # $1${RESET}\n"
}

cd /Users/mostafamilly/Documents/Projects/full-stack-demo

clear
printf "\n  ${MAGENTA}${BOLD}📁 ~/Projects/full-stack-demo${RESET}\n\n"

# ── Step 1: Show the project ──────────────────────
prompt
simulate_typing "${CYAN}" "ls"
echo ""
sleep 0.3
ls -1
sleep 1

# ── Step 2: Show existing Copilot rules ───────────
comment "This project already has Copilot instructions"
prompt
simulate_typing "${CYAN}" "cat .github/copilot-instructions.md"
echo ""
sleep 0.3
cat .github/copilot-instructions.md
sleep 1.2

# ── Step 3: Sync to all agents ───────────────────
comment "One command to sync them everywhere"
prompt
simulate_typing "${YELLOW}" "npx nymor sync"
simulate_typing "${DIM}" " --agents claude cursor copilot"
echo ""
sleep 0.5
nymor sync --agents claude cursor copilot
sleep 1.5

# ── Step 4: Show status ─────────────────────────
prompt
simulate_typing "${YELLOW}" "nymor status"
echo ""
sleep 0.5
nymor status
sleep 2.5

echo ""
