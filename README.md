# Opencode + Stream Deck Stats

Open source stream deck plugin & opencode plugin to get real time stats from opencode.

<img src="/docs/SCREENSHOT.jpg" width="600" />

This repo now has two clearly separated parts:

- `opencode-plugin/` - the OpenCode plugin that does stats aggregation and serves a local `/stats` endpoint.
- `streamdeck-plugin/` - the Stream Deck plugin (store-facing package) that renders keys and reads stats.

## Setup Instructions

You need two parts to make this work:

### Opencode Stats Plugin

<package-instructions>

### Elgato Streamdeck Plugin

Coming soon...

## Goal

Install one file into `~/.config/opencode/plugins` for OpenCode-side heavy lifting,
and distribute the Stream Deck plugin as the user-facing package.

## Folder layout

```
opencode-plugin/
  opencode-streamdeck-stats.js
  README.md

streamdeck-plugin/
  com.chrisfryer.opencode-stats.sdPlugin/
  src/
  scripts/
  package.json
  README.md
```

## Quick start

1. Install the OpenCode plugin from `opencode-plugin/README.md`.
2. Build/deploy the Stream Deck plugin from `streamdeck-plugin/README.md`.
3. Restart OpenCode and Stream Deck.

## Workspace commands

From repo root:

- `npm run opencode:install`
- `npm run streamdeck:build`
- `npm run streamdeck:watch`

## Automated release (GitHub -> npm)

Package name: `opencode-streamdeck-stats`

This repo includes `.github/workflows/release.yml` and semantic-release config.
On every push to `main`, the workflow will:

1. Create a GitHub Release
2. Publish `opencode-plugin/` to npm

### One-time npm trusted publishing setup

1. Ensure the package exists on npm (`opencode-streamdeck-stats`).
   - npm currently requires package settings to exist before you can attach a trusted publisher.
   - If this is the first release ever, publish once manually from `opencode-plugin/` to bootstrap:

   ```bash
   cd opencode-plugin
   npm publish --access public --provenance=false
   ```
2. Open `https://www.npmjs.com/package/opencode-streamdeck-stats/access`.
3. Add a Trusted Publisher:
   - Provider: GitHub Actions
   - Owner/User: `cfryerdev`
   - Repository: `opencode-streamdeck-stats`
   - Workflow file: `release.yml`
   - Allowed action: `npm publish`
4. Push to `main`.

The workflow uses GitHub OIDC trusted publishing (`id-token: write`) and does not require `NPM_TOKEN`.
