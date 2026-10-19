# Working on NarraPlot

NarraPlot turns a small table into an editable, portable visual story. Read
`README.md`, `docs/product.md`, and the files touched by your task before editing.
These instructions also apply to coding assistants. An assistant's work has the
same acceptance bar as any other contribution.

## Start from a concrete result

- State the user-visible problem and an observable acceptance condition.
- Inspect current code and open work before proposing a second implementation.
- Keep one pull request about one coherent behavior. Do not split a change into
  filler PRs or bundle unrelated cleanup to increase apparent output.
- Stay within the assigned files and behavior. If a change needs a new library,
  a project-format migration, or a wider refactor, explain that need first.

## Data and rendering invariants

- Labels remain strings. Parse only a column the user explicitly mapped as values.
- Reject unsupported or ambiguous input with an actionable error. Never silently
  turn a missing value into zero, merge duplicate labels, drop rows, or invent data.
- Preserve one validated project model and one chart renderer across the preview
  and exports. All scenes share their dataset and axis domain.
- User text is text. Escape it for SVG and HTML; imported projects cannot inject
  scripts, styles, remote assets, or executable configuration.
- Replacing data invalidates annotations until reviewed. Do not preserve an old
  conclusion as if it had been checked against the new values.
- Keep runtime processing local. Network services, telemetry, and AI calls are
  product decisions, not convenient implementation shortcuts.

## Verify what changed

Run `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`
for code changes. Use `npm run format` to apply the existing source style.
Use `npm run test:browser` when import, editing, downloads, or browser interaction
changes. Add a focused regression test for a real failure; avoid tests that merely
repeat an implementation or inflate coverage. Documentation-only changes need
link and claim verification, not a new test suite.

For a visual change, inspect the real editor and attach before/after evidence at a
desktop and a narrow viewport. For an export change, inspect an exported artifact;
a screenshot of the editor alone does not verify the export.

Do not claim a command, browser, exported file, CI run, or user experience was
checked unless you actually checked it. State any concrete limitation.

## Finish with a reviewable PR

Explain the problem, resulting behavior, verification, and remaining limitations.
Use public, reproducible context. Keep credentials, personal conversations, private
planning notes, and private data out of commits, issues, screenshots, and PR text.
Disclose substantial AI assistance briefly in the PR template. Do not fabricate
human reviews, usage statistics, citations, or testimonials.

Do not merge, publish a release, or post promotional messages as part of an
implementation task unless the maintainer explicitly assigned that action.
Passing CI and receiving a maintainer review are separate conditions. Commit
workflow files do not configure branch protection by themselves.
