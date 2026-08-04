# Opencode + Stream Deck Stats

Open source stream deck plugin & opencode plugin to get real time stats from opencode.

<img src="/docs/SCREENSHOT.jpg" width="600" />

This repo now has two clearly separated parts:

- `opencode-plugin/` - the OpenCode plugin that does stats aggregation and serves a local `/stats` endpoint.
- `streamdeck-plugin/` - the Stream Deck plugin (store-facing package) that renders keys and reads stats.

## Setup Instructions

You need two parts to make this work:

### 1. Opencode Stats Plugin

Add `opencode-streamdeck-stats` to the `plugin` array in your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-streamdeck-stats"
  ]
}
```

Then restart opencode. The plugin starts a local stats server on `http://127.0.0.1:4649` that the Stream Deck plugin reads from.

#### Optional environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `OPENCODE_STREAMDECK_HOST` | `127.0.0.1` | Host to bind the stats server |
| `OPENCODE_STREAMDECK_PORT` | `4649` | Port for the stats server |
| `OPENCODE_DB_PATH` | `~/.local/share/opencode/opencode.db` | Path to the opencode SQLite database |

#### Verify it's running

```bash
curl http://127.0.0.1:4649/health
# {"ok":true,"service":"opencode-streamdeck-stats"}

curl http://127.0.0.1:4649/stats
# {"totalCost":126.68,"costLastDay":5.43,"costLast30Days":5.43,...}
```

### 2. Elgato Stream Deck Plugin (Local Install)

Download the latest `.sdPlugin` zip from [GitHub Releases](https://github.com/cfryerdev/opencode-streamdeck-stats/releases), then extract and copy it into Stream Deck's plugins directory:

**macOS:**

```bash
# Download the latest release zip
curl -L -o sdPlugin.zip \
  https://github.com/cfryerdev/opencode-streamdeck-stats/releases/latest/download/opencode-streamdeck-stats-sdPlugin-1.1.0.zip

# Extract
unzip sdPlugin.zip

# Install into Stream Deck's plugins directory
cp -R com.chrisfryer.opencode-stats.sdPlugin \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/

# Restart Stream Deck
pkill -f "Stream Deck"; sleep 2; open "/Applications/Elgato Stream Deck.app"
```

**Windows (PowerShell):**

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/cfryerdev/opencode-streamdeck-stats/releases/latest/download/opencode-streamdeck-stats-sdPlugin-1.1.0.zip" -OutFile "sdPlugin.zip"

# Extract
Expand-Archive sdPlugin.zip -DestinationPath .

# Install
Copy-Item -Recurse com.chrisfryer.opencode-stats.sdPlugin `
  "$env:APPDATA\Elgato\StreamDeck\Plugins\"
```

After installing, open the Stream Deck app and drag actions from the **Opencode** category onto your keys.


## Folder layout

```
opencode-plugin/
  opencode-streamdeck-stats.js
  package.json
  README.md

streamdeck-plugin/
  com.chrisfryer.opencode-stats.sdPlugin/
  src/
  scripts/
  package.json
  README.md
```

## Developer Quick start

1. Add `"opencode-streamdeck-stats"` to the `plugin` array in your `opencode.json`.
2. Restart opencode.
3. Build/deploy the Stream Deck plugin from `streamdeck-plugin/README.md`.

### Workspace commands

From repo root:

- `npm run opencode:install`
- `npm run streamdeck:build`
- `npm run streamdeck:watch`

### Automated release (GitHub -> npm)

Package name: `opencode-streamdeck-stats`

On every push to `main`, `.github/workflows/release.yml` reads the version from `opencode-plugin/package.json`, and if that version isn't already on npm, it:

1. Publishes to npm via OIDC trusted publishing (with provenance)
2. Tags the release (`v<version>`)
3. Creates a GitHub Release with auto-generated notes

To release a new version, bump `version` in `opencode-plugin/package.json` and push to `main`.
