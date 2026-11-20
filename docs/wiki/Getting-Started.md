# Getting started

```sh
git clone https://github.com/sriinnu/baton.git ~/code/baton   # not on npm yet
cd ~/code/baton && npm link                                # Node >= 20, zero dependencies
cd your-repo && baton init                                 # creates .baton/ (gitignored)
```

Leaving: `baton handover --name auth-fix`, then the agent fills the prose.
Arriving: `baton takeover auth-fix --name auth-fix-2`.

Claude Code plugin: `claude plugin marketplace add ~/code/baton` then `claude plugin install baton@sriinnu-baton`; restart the app.
Codex: copy the skills to `~/.codex/skills/` (see README) or `codex/*.md` to `~/.codex/prompts/`. No `notify` line: baton runs only when called.
Picking up a session nobody handed over: `baton takeover codex "<thread name>"`, `baton takeover claude last`, add `--distill` to have the cheap model write the brief.
Any other agent: paste `rules/AGENTS.snippet.md` into its rules file.
