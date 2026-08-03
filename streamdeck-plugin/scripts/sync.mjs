import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";

const source = join(process.cwd(), ".sdPlugin");
const dest = join(
  homedir(),
  "Library/Application Support/com.elgato.StreamDeck/Plugins/com.chrisfryer.opencode-stats.sdPlugin",
);

if (!existsSync(source)) {
  console.error("sync: .sdPlugin not found. Run `npm run build` first.");
  process.exit(1);
}

// Robust removal — rmSync can fail with ENOTEMPTY if the plugin process
// has file handles open. Try recursive rmSync first, then fall back to
// removing individual files.
function removeDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
    return;
  } catch {
    // Fallback: remove files one by one, then directories
    if (!existsSync(dir)) return;
    function clean(path) {
      for (const entry of readdirSync(path)) {
        const full = join(path, entry);
        try {
          if (existsSync(full)) {
            const stat = rmSync(full, { recursive: true, force: true });
          }
        } catch {
          try { unlinkSync(full); } catch {}
        }
      }
      try { rmdirSync(path); } catch {}
    }
    clean(dir);
  }
}

removeDir(dest);
mkdirSync(join(dest, "logs"), { recursive: true });

cpSync(source, dest, {
  recursive: true,
  filter: (src) => basename(src) !== "logs",
});

mkdirSync(join(dest, "logs"), { recursive: true });

console.log(`sync: deployed to ${dest}`);
