# Reproducible review evidence

Contributors may use the local commands in AGENTS.md or the existing GitHub Actions workflow. Local npm networking and browser access are not required when the remote evidence route works.

A code-complete draft PR triggers Product checks. The workflow checks out and verifies the exact PR head (not an implicit merge ref), uses Node 24 and the committed lockfile, runs formatting, types, unit tests, build and browser regressions, then captures the real application. For a PR it also builds the exact base revision and runs the same capture script against it. This baseline capture is a comparison, not a claim that the new change was tested on the base.

Download the artifact named `product-evidence-<head-sha>-<run-attempt>` from that workflow. It contains:

- Playwright HTML/JSON reports, failure screenshots and retained failure traces.
- `evidence/head/` and, for PRs, `evidence/base/`: actual desktop (1600px) and narrow (390px) editor/import screenshots, a PNG export, a portable HTML export and runtime/capture results.
- `evidence/manifest.json`: repository, exact head/base, run/attempt, check outcomes and SHA-256 hashes of the evidence files.
- `evidence/source.tar`: only the public tracked source at the tested head, for reproducible connector-only source access. It is not a dependency cache or an installed runtime.

Compare the artifact's digest to GitHub's artifact metadata, check the manifest head against the current PR head, verify file hashes and inspect the actual screenshots/exports. A successful artifact upload is not a successful test. Failure artifacts are uploaded too. The JSON report must have no unexpected failures; flaky retries must be disclosed. Pending or failed checks are never reported as passed.

The screenshots use synthetic data only. They are review evidence, not automatically approved visual baselines. Add task-specific scenarios when a change needs them. A green test job does not replace visual inspection. Artifacts expire after 14 days; preserve a concise reviewed receipt and durable accepted examples when needed.

Changing the PR head invalidates earlier evidence. Re-run and review the final head before merging, check current repository rules, then confirm GitHub's actual merge result. These steps do not authorize bypassing branch protections or executing repository code with privileged tokens. Workflows use read-only repository permissions and do not persist credentials or receive product secrets.
