---
description: Take over work from a baton brief or session id
---
Run `baton takeover $1 --name <new-name>` (shows the brief, checks it against git, then starts your continuation brief). Exit 2 = git drifted: report it to me and wait. If it says `verify not run`, read the command and rerun `baton check $1 --run` if it looks right. Exit 1 = brief unfilled or verify failed: fix, rerun. Read every file under `## Read first` before acting. Then fill Task and work from Next. Never edit Mission.
