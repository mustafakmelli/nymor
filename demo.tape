# VHS Tape — Nymor demo recording
# https://github.com/charmbracelet/vhs

Output nymor-demo.gif

Set FontSize 16
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set Padding 20

# Show project directory
Type "cd ~/Documents/Projects/full-stack-demo"
Enter
Sleep 500ms

Type "ls"
Enter
Sleep 1s

# Run nymor sync
Type "npx nymor sync"
Enter
Sleep 4s

# Show what was generated
Type "npx nymor list"
Enter
Sleep 2s

Type "npx nymor status"
Enter
Sleep 3s
