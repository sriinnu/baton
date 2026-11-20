# Changelog

All notable changes to baton are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- `baton init` ignores `.baton/` through `.git/info/exclude` (the common dir, so every worktree sees it) instead of appending to your tracked `.gitignore`. If any rule already ignores `.baton/`, it adds nothing. Existing `.gitignore` entries are left as they are.

### Added
- `SECURITY.md`: report vulnerabilities privately through GitHub's private vulnerability reporting.

## [0.2.0] - 2026-11-20

First npm release: `npm i -g @sriinnu/baton`.

### Changed
- **baton runs only when called.** The plugin's `Stop`/`PreCompact`/`SubagentStop` hooks and the Codex `notify` setup are gone, along with per-turn sync and pending-brief adoption. The agent writes the brief at handover from its warm cache; a model is called only by `baton sync <ref>` or `takeover --distill`. `sync --hook` is kept as a silent no-op, so an old hook or `notify` line cannot break an agent: remove it.
- `handover` binds the brief to the session writing it (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`), so `sync` can refresh it later.
- `sync` reads the conversation itself (user and agent text, one line per tool, failure tails) instead of the skeleton, in parts of ~60k chars with one model call each; past ~360k chars it keeps the first goal and the most recent activity.
- The CLI lives in `plugin/` (`plugin/cli/`, `plugin/src/`), so the plugin is self-contained and needs only Node 20+. Root `package.json` `bin` points to `plugin/cli/baton.js`; skills run the bundled CLI through `${CLAUDE_PLUGIN_ROOT}`.
- README installs from npm; a clone is only needed for the Claude plugin and the Codex skills.
- New logo: a cleaner "b" whose bowl hands the work back to the baton.

### Added
- `baton takeover [claude|codex] <ref>`: `<ref>` can be a session id, an id prefix, a session name (Codex thread name, Claude Code title; exact match first, newest wins; an ambiguous partial lists candidates) or `last` (the newest session whose cwd is this repo). A session with no brief gets one from the extract; `--distill` fills it with one cheap-model pass over the whole session.
- Codex 0.160+ transcripts (`item_completed` events, Desktop and CLI): user and agent messages, commands with exit codes and failure output, file changes, MCP calls, token usage, model, parent thread.
- Archived Codex threads (`~/.codex/archived_sessions/*.jsonl.zst`) are found and read (Node ≥ 22.15).
- `baton doctor [--limit n]`: runs the readers on your newest real Claude and Codex sessions and exits 1 if one reads empty, so a transcript format change shows up at once.
- `baton takeover` prints a `--- switch ---` block: previous vs new provider and model, old session context vs brief size, tokens not re-sent cold (estimate), and cache read/write totals from the old transcript.
- `--model` and `--provider` options. Briefs record the model that wrote them (`model:` in the frontmatter); the skills pass the agent's own model id. Session readers report the model behind a transcript.
- `npm run pack:plugin` builds `dist/baton-plugin.zip` for the claude.ai "Upload a plugin" dialog.
- Release tooling: `scripts/release-gate.mjs` (`prepublishOnly`; refuses unless on signed master with a clean tree, a signed tag at HEAD, versions in lockstep, a changelog entry and passing tests) and a `publish-npm` workflow that only stages releases through trusted publishing, with no npm token.
- MIT `LICENSE`, `CHANGELOG.md`, author and repository metadata, `development` category.

### Fixed
- The Codex reader returned 0 turns on every session from Codex 0.160+.
- `index.json` writes are atomic and locked, so parallel agents and worktrees can't drop each other's briefs (20 concurrent writers tested).
- A takeover could let a later sync overwrite the handed-over brief; the continuation is now its own brief, bound to the arriving session.
- `## Read first` listed `MISSION.md` twice on case-insensitive filesystems.
- Upload rejected the archive: the plugin manifest was not at the zip root, and claude.ai refuses a top-level `bin/` folder (renamed to `cli/`).
- The test suite no longer inherits your global git config (hooks, signing) or the host agent's session id.

## [0.1.0] - 2026-11-19

### Added
- Distilled, inheritable briefs: `init`, `write`/`handover`, `show`/`gist`, `takeover`, `child`, `fold`, `ls`, `check`, `sync`.
- Git-checked state (drift detection) and a `verify` command per brief.
- Session readers for Claude Code and Codex, plus a generic `--path` reader.
- Claude Code plugin: `handover`, `switch` and `takeover` skills; Stop, PreCompact and SubagentStop sync hooks.
- Codex integration (`codex/`, `rules/AGENTS.snippet.md`) and a browser playground.
