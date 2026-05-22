# AMEO Mintlify deployment

**Content root:** `../docs/` (product MDX + `mint.json`)

Mintlify content root: **`../docs/`**. Point the GitHub App there.

**Assets in this folder:** legacy logo copies under `logo/` — canonical logos live in `docs/logo/`.

## One-time setup

1. Install the [Mintlify GitHub App](https://mintlify.com) on the repository.
2. Point Mintlify at the **`docs/`** folder (not `docs-site/`).
3. Add DNS CNAME: `docs.ameo.agiwithai.com` → Mintlify.
4. Confirm the sidebar shows six groups from `docs/mint.json`.

## Local dev

```bash
cd docs
npx -y mintlify@latest dev
```

## Validate links (CI)

```bash
cd docs
npx -y mintlify@latest broken-links
```

Submission materials live under `submission/` in the repo root. This `docs-site/` folder only holds the Mintlify mirror config now that content moved to `docs/`. Internal scaffolding lives in `agent-context/` (gitignored).
