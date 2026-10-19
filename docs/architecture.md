# Architecture and deployment

NarraPlot is a static React/TypeScript application built with Vite. It has no
application server, database, model provider, or authentication requirement.

## Boundaries

| Directory | Responsibility |
| --- | --- |
| `src/data` | CSV reading, explicit numeric parsing, column mapping |
| `src/story` | Project model, validation, sample story, data replacement rules |
| `src/render` | Deterministic SVG chart/story rendering and export |
| `src/ui` | Import controls, story editing, browser interaction |
| `tests` | Behavioral unit tests and Playwright workflows |

Import produces strings, mapping produces validated data points, and the project
validator produces the single editable story model. The renderer consumes that
model for both previews and exported scenes. Browser downloads are adapters around
that rendering path.

Avoid a second chart library or a separate export implementation unless there is
a measured reason: visual parity is easier to maintain with one renderer.

## State and persistence

The editor holds the current project in browser memory. Draft retention starts
off; an explicit opt-in stores `true` under `narraplot.remember-draft.v1` and enables
best-effort writes to the existing `narraplot.draft.v1` key. The draft format and
project schema are unchanged, and the saved copy includes imported data.

Startup reads storage before allowing writes; a fresh visit with no saved opt-in
does not write a draft or preference. A stored draft becomes a pending
restore/discard choice while the editor opens the example. Saving is paused until
that choice is resolved, including when the draft is empty, malformed, or from an
unsupported schema. Pending bytes are not replaced by edits, imports, or exports.
Earlier alpha drafts without a preference are recoverable with remembering off.
Restoration validates the project and replaces the open story; if the user has
already edited it, a confirmation protects those edits.

Turning remembering off removes only the preference key and leaves the saved
draft. Forget/discard synchronously closes the write gate, turns retention off in
the current tab, and independently attempts to remove both owned keys. Partial
deletion and preference failures are reported accurately. A failed draft deletion
keeps the pending candidate available; no storage operation clears unrelated keys.
Storage access and quota errors preserve editor/export operation and direct the
user to project-file saving. Read failures keep writes disabled until a successful
retry can inspect any existing draft. This alpha has no multi-tab synchronization
and cannot prevent another already-open tab from saving.

Users can download and reopen project files for a copy they control. Import and
export should fail visibly without destroying the current project.

Project text is untrusted data. Validation reconstructs supported fields;
rendering escapes text before placing it in SVG or HTML. External resources are
not part of the project format.

## Validation

`npm run typecheck` checks the TypeScript contracts, `npm test` checks data and
rendering behavior, and `npm run test:browser` exercises real browser flows.
`npm run build` creates the production bundle and also checks types.

The GitHub Actions workflow runs with read-only repository contents permission.
It does not deploy, merge pull requests, or access a private planning repository.
The repository owner can separately require the `verify` check in a main-branch
ruleset after the first workflow run. A workflow file does not turn that setting on.

## Static deployment

```bash
npm ci
npm run build
npm run preview
```

Serve the generated `dist/` directory with a static host. The Vite base is `./`
so assets can be served beneath a repository path as well as a domain root.
`npm run preview` is a local production-build check, not a managed hosting service.
No hosted demo or deployment is configured by the initial commit.

Portable HTML exports are separate self-contained documents. They do not need
this application bundle or a NarraPlot server to display their three scenes.
