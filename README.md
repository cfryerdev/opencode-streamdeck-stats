# Opencode + Stream Deck Stats

Open source stream deck plugin & opencode plugin to get real time stats from opencode.

<img src="/docs/SCREENSHOT.jpg" width="600" />

This repo now has two clearly separated parts:

- `opencode-plugin/` - the OpenCode plugin that does stats aggregation and serves a local `/stats` endpoint.
- `streamdeck-plugin/` - the Stream Deck plugin (store-facing package) that renders keys and reads stats.

## Goal

Install one file into `~/.config/opencode/plugins` for OpenCode-side heavy lifting,
and distribute the Stream Deck plugin as the user-facing package.

## Folder layout

```
opencode-plugin/
  opencode-streamdeck-stats.js
  README.md

streamdeck-plugin/
  .sdPlugin/
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

### One-time npm setup

1. Ensure the npm package name is available (or create it under your npm org).
2. Create an npm access token with publish rights.
3. In GitHub repo settings, add secret `NPM_TOKEN`.
4. Push to `main`.

The workflow uses `GITHUB_TOKEN` (automatic) and `NPM_TOKEN` (you provide).
