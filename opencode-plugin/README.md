# OpenCode Stats Plugin

This plugin runs inside OpenCode and serves Stream Deck-ready stats at:

- `GET /health`
- `GET /stats`

Default bind: `127.0.0.1:4649`

## Install

1. Create the global plugins directory if it does not exist:

```bash
mkdir -p ~/.config/opencode/plugins
```

2. Copy this plugin file:

```bash
cp opencode-streamdeck-stats.js ~/.config/opencode/plugins/opencode-streamdeck-stats.js
```

Alternative (from npm package):

```bash
npm view opencode-streamdeck-stats version
npm pack opencode-streamdeck-stats
tar -xzf opencode-streamdeck-stats-*.tgz
cp package/opencode-streamdeck-stats.js ~/.config/opencode/plugins/opencode-streamdeck-stats.js
rm -rf package opencode-streamdeck-stats-*.tgz
```

3. Restart OpenCode.

OpenCode loads plugins at startup. Restart is required after updating this file.

## Environment overrides

- `OPENCODE_STREAMDECK_HOST` (default: `127.0.0.1`)
- `OPENCODE_STREAMDECK_PORT` (default: `4649`)
- `OPENCODE_DB_PATH` (default: `~/.local/share/opencode/opencode.db`)

## Response shape

`GET /stats` returns:

```json
{
  "ok": true,
  "source": "opencode-plugin",
  "generatedAt": 0,
  "stats": {
    "totalCost": 0,
    "costPerDay": 0,
    "costLastDay": 0,
    "costLast30Days": 0,
    "costThisMonth": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "reasoningTokens": 0,
    "cacheRead": 0,
    "cacheWrite": 0,
    "activeSessions": 0,
    "totalSessions": 0,
    "tokensPerSession": 0
  }
}
```

Notes:

- Uses the local OpenCode SQLite DB.
- Excludes subtask sessions (`parent_id IS NOT NULL`) to avoid double counting.
