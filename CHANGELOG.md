# Changelog

All notable changes to baton are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- `baton takeover` prints a `--- switch ---` block: previous vs new provider and model, old session context vs brief size, tokens not re-sent cold (estimate), and cache read/write totals from the old transcript.
- `--model` and `--provider` options. Briefs record the model that wrote them (`model:` in the frontmatter). The skills pass the agent's own model id.
- Session readers report the model that produced a transcript (Claude Code and Codex).
- MIT `LICENSE`, `CHANGELOG.md`, author and repository metadata, `development` category.
- `npm run pack:plugin` builds `dist/baton-plugin.zip` for the claude.ai "Upload a plugin" dialog.

### Changed
- The CLI now lives in `plugin/` (`plugin/cli/`, `plugin/src/`) so the plugin is self-contained: no `npm link`, only Node 20+. Root `package.json` `bin` points to `plugin/cli/baton.js`.
- Hooks and skills run the bundled CLI through `${CLAUDE_PLUGIN_ROOT}`.

### Fixed
- Upload rejected the archive: the plugin manifest was not at the zip root, and claude.ai refuses a top-level `bin/` folder (renamed to `cli/`).

## [0.1.0] - 2026-11-19

### Added
- Distilled, inheritable briefs: `init`, `write`/`handover`, `show`/`gist`, `takeover`, `child`, `fold`, `ls`, `check`, `sync`.
- Git-checked state (drift detection) and a `verify` command per brief.
- Session readers for Claude Code and Codex, plus a generic `--path` reader.
- Claude Code plugin: `handover`, `switch` and `takeover` skills; Stop, PreCompact and SubagentStop sync hooks.
- Codex integration (`codex/`, `rules/AGENTS.snippet.md`) and a browser playground.
