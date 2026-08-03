# Stream Deck Plugin (Opencode)

This is the Stream Deck plugin package.

For best results, install the OpenCode stats plugin first from `../opencode-plugin/`.

It reads stats in this order:

1. OpenCode plugin endpoint (`http://127.0.0.1:4649/stats`)
2. Local OpenCode SQLite DB fallback
3. OpenCode local API fallback (`http://127.0.0.1:4096`)

## Dev commands

```bash
npm run build
npm run watch
npm run sync
npm run validate
npm run pack
```

## Deploy location

The sync script deploys to:

`~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.chrisfryer.opencode-stats.sdPlugin/`

## Store packaging

This folder is the store-facing plugin package root (`com.chrisfryer.opencode-stats.sdPlugin` + build tooling).

After metadata/icon updates, bump `com.chrisfryer.opencode-stats.sdPlugin/manifest.json` version before restart so Stream Deck refreshes cache.

To produce the `.streamDeckPlugin` file required by the Elgato Marketplace Maker portal:

```bash
npm run pack
```

This builds the plugin, validates it against the Elgato schema, and writes
`dist/com.chrisfryer.opencode-stats.streamDeckPlugin`, which is the file to upload in Maker.
