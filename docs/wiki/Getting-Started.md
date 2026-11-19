# Getting started

```sh
npm i -g @sriinnu/baton     # Node >= 20, zero dependencies
cd your-repo && baton init  # creates .baton/ (gitignored)
```

Leaving: `baton handover --name auth-fix`, then the agent fills the prose.
Arriving: `baton takeover auth-fix --name auth-fix-2`.

Claude Code plugin: `claude plugin marketplace add sriinnu/baton` then `claude plugin install baton@sriinnu-baton`.
Codex: copy `codex/*.md` to `~/.codex/prompts/`; set `notify = ["baton", "sync", "--hook"]` in `~/.codex/config.toml`.
Any other agent: paste `rules/AGENTS.snippet.md` into its rules file.
