---
description: Take over work from a baton brief, or a Claude Code/Codex session by id, name or last
---
Run `baton takeover $ARGUMENTS --name <new-name>` (`$ARGUMENTS` may be `claude <id|name|last>` or `codex <id|name|last>`; if it says `brief started from … session`, fill it from its Extract or rerun with `--distill`) (shows the brief, checks it against git, then starts your continuation brief). Exit 2 = git drifted: report it to me and wait. If it says `verify not run`, read the command and rerun `baton check $1 --run` if it looks right. Exit 1 = brief unfilled or verify failed: fix, rerun. Read every file under `## Read first` before acting. Then fill Task and work from Next. Never edit Mission.
