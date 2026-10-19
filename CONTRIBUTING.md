# Contributing

Thanks for helping make small data stories easier to create.

## A useful issue

Describe what you were trying to do, the smallest steps that reproduce the issue,
and the result you expected. Include your browser and a tiny synthetic CSV when
relevant. Please remove personal or confidential information from attached data,
project files, exports, and screenshots.

Search existing issues and pull requests first. A confirmed problem in an
existing feature is more useful than an unbounded list of possible features.

## A useful pull request

1. Read `docs/product.md` and `AGENTS.md` for the product boundaries.
2. Start from the latest `main` and make a branch for one coherent change.
3. Reproduce the problem, implement the change, and verify the acceptance condition.
4. Follow the PR template. Include a screenshot for a visual change or a sample
   artifact for an export change.

Use Node.js 24. Install dependencies with `npm ci`; run `npm run format:check`,
`npm run typecheck`, `npm test`, and `npm run build`. Use `npm run format` to apply
the source style. Browser workflows use Playwright:

```bash
npx playwright install chromium
npm run test:browser
```

For a documentation-only correction, check the relevant claims and links instead
of adding tests. For a bug fix, a test that would fail before the fix is valuable.

## Design and dependencies

Keep the editor focused on table → story → export. Prefer the existing project
model, components, and SVG renderer. New dependencies should solve a named problem
and justify their effect on the browser bundle, maintenance, and local processing.
Changes to the saved project format need an explicit compatibility decision.

The first release intentionally has one series, three scenes, and small datasets.
Discuss a larger scope before building it; the [product brief](docs/product.md)
records the current direction.

## AI assistance

AI-assisted contributions are welcome. The author remains responsible for their
accuracy, readability, tests, and provenance. Note substantial assistance in the
PR and include evidence a reviewer can reproduce. Generated prose, abstractions,
or code that do not improve the user's task should be removed.

There is no public-contributor dependency on an internal planning system. An
ordinary fork and pull request is enough.
