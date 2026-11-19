# Getting started

```sh
git clone https://github.com/sriinnu/baton.git ~/code/baton   # not on npm yet
cd ~/code/baton && npm link                                # Node >= 20, zero dependencies
cd your-repo && baton init                                 # creates .baton/ (gitignored)
```

Leaving: `baton handover --name auth-fix`, then the agent fills the prose.
Arriving: `baton takeover auth-fix --name auth-fix-2`.

Claude Code plugin: `claude plugin marketplace add ~/code/baton` then `claude plugin install baton@sriinnu-baton`; restart the app.
Codex: copy `codex/*.md` to `~/.codex/prompts/`; set `notify = ["baton", "sync", "--hook"]` in `~/.codex/config.toml`.
Any other agent: paste `rules/AGENTS.snippet.md` into its rules file.
