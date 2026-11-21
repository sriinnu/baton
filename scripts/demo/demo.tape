Output "/private/tmp/baton-demo/demo.gif"
Set Shell "bash"
Set FontSize 16
Set Width 1440
Set Height 800
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set WindowBar Colorful

Hide
Type `export PATH=/private/tmp/baton-demo/bin:$PATH HOME=/private/tmp/baton-demo/home CODEX_THREAD_ID=019e0000-cafe-7000-8000-000000000001 PS1='\[\e[1;33m\]shop\[\e[0m\] $ ' && /private/tmp/baton-demo/reset.sh && cd /private/tmp/baton-demo/shop && clear` Enter
Sleep 1s
Show

Type "# Claude Code ran out of context mid-fix. Codex picks it up:" Sleep 600ms Enter
Type "baton takeover claude last" Sleep 400ms Enter
Sleep 3s
Type "# baton read the session. What it pulled out (secrets redacted):" Sleep 500ms Enter
Type `sed -n '/## Extract/,$p' .baton/briefs/c0ffee00*.md` Sleep 400ms Enter
Sleep 6s
Hide
Type "cp /private/tmp/baton-demo/filled-brief.md .baton/briefs/c0ffee00-1234-4abc-8def-000000000042.md && clear" Enter
Sleep 500ms
Show
Type "# The agent fills Mission, Done, Next from that. Then:" Sleep 500ms Enter
Type "baton takeover c0ffee00 --model gpt-6.1-sol | tail -9" Sleep 400ms Enter
Sleep 7s
Type "# A 189k-token session, handed over as a 325-token brief checked against git. (demo session)" Sleep 3s Enter
Sleep 2s
