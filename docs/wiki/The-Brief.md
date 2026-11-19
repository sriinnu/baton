# The brief

Flat frontmatter (`id name agent parent mission generated`) then sections:
Mission, Lineage, Task, Decisions, Done, Next, Dead ends, Open questions, Report back, Check, State.

- **Mission**: one paragraph, set once at the root, copied verbatim.
- **Decisions**: with the why; the next agent does not relitigate.
- **State**: branch, HEAD, dirty files, optional `verify:` command. Measured from git, never written by a model.
- `## Extract`: machine appendix (first goal, files, commands, errors); removed once the brief is filled or synced.
- Unfilled fields hold `<!-- fill -->`; `check` exits 1 until they are gone.
- Soft cap 150 lines. A brief is a distillation, never a transcript.
