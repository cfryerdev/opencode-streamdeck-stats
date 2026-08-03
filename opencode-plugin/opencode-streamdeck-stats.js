import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_HOST = process.env.OPENCODE_STREAMDECK_HOST || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.OPENCODE_STREAMDECK_PORT || 4649);
const DEFAULT_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

const SERVER_STATE_KEY = "__opencodeStreamdeckStatsServer";

function getState() {
  const globalObject = globalThis;
  if (!globalObject[SERVER_STATE_KEY]) {
    globalObject[SERVER_STATE_KEY] = {
      started: false,
      transport: "none",
      stop: undefined,
    };
  }
  return globalObject[SERVER_STATE_KEY];
}

function toNumber(value) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildStats(row) {
  const totalCost = toNumber(row.total_cost);
  const inputTokens = toNumber(row.input_tokens);
  const outputTokens = toNumber(row.output_tokens);
  const reasoningTokens = toNumber(row.reasoning_tokens);
  const cacheRead = toNumber(row.cache_read);
  const cacheWrite = toNumber(row.cache_write);
  const costLastDay = toNumber(row.cost_last_day);
  const costLast30Days = toNumber(row.cost_last_30_days);
  const totalSessions = toNumber(row.total_sessions);
  const activeSessions = toNumber(row.active_sessions);
  const earliestCreated = toNumber(row.earliest_created);
  const latestUpdated = toNumber(row.latest_updated);

  const totalTokens = inputTokens + outputTokens + reasoningTokens + cacheRead + cacheWrite;
  const tokensPerSession = totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;

  const days =
    earliestCreated > 0 && latestUpdated > 0
      ? Math.max(1, Math.ceil((latestUpdated - earliestCreated) / 86_400_000))
      : 1;

  return {
    totalCost,
    costPerDay: totalCost / days,
    costLastDay,
    costLast30Days,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheRead,
    cacheWrite,
    activeSessions,
    totalSessions,
    tokensPerSession,
  };
}

async function queryStats() {
  const dbPath = process.env.OPENCODE_DB_PATH?.trim() || DEFAULT_DB_PATH;
  const query =
    "SELECT " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN cost ELSE 0 END), 0) AS total_cost, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN tokens_input ELSE 0 END), 0) AS input_tokens, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN tokens_output ELSE 0 END), 0) AS output_tokens, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN tokens_reasoning ELSE 0 END), 0) AS reasoning_tokens, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN tokens_cache_read ELSE 0 END), 0) AS cache_read, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN tokens_cache_write ELSE 0 END), 0) AS cache_write, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL AND time_updated >= (strftime('%s','now')*1000 - 86400000) THEN cost ELSE 0 END), 0) AS cost_last_day, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL AND time_updated >= (strftime('%s','now')*1000 - 30*86400000) THEN cost ELSE 0 END), 0) AS cost_last_30_days, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END), 0) AS total_sessions, " +
    "COALESCE(SUM(CASE WHEN parent_id IS NULL AND time_archived IS NULL THEN 1 ELSE 0 END), 0) AS active_sessions, " +
    "COALESCE(MIN(CASE WHEN parent_id IS NULL THEN time_created END), 0) AS earliest_created, " +
    "COALESCE(MAX(CASE WHEN parent_id IS NULL THEN time_updated END), 0) AS latest_updated " +
    "FROM session;";

  const { stdout } = await execFileAsync("sqlite3", ["-json", dbPath, query]);
  const rows = JSON.parse(stdout || "[]");
  return buildStats(rows[0] || {});
}

function jsonResponse(payload, status = 200) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

async function route(pathname) {
  if (pathname === "/health") {
    return jsonResponse({ ok: true, service: "opencode-streamdeck-stats" });
  }

  if (pathname === "/stats") {
    const stats = await queryStats();
    return jsonResponse({
      ok: true,
      source: "opencode-plugin",
      generatedAt: Date.now(),
      stats,
    });
  }

  return jsonResponse({ ok: false, error: "Not found" }, 404);
}

function startNodeServer(host, port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      const response = await route(url.pathname);
      res.writeHead(response.status, response.headers);
      res.end(response.body);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ok: false,
          error: String(error instanceof Error ? error.message : error),
        }),
      );
    }
  });

  server.listen(port, host);
  return () => {
    server.close();
  };
}

function startBunServer(host, port) {
  const server = Bun.serve({
    hostname: host,
    port,
    fetch: async (request) => {
      try {
        const url = new URL(request.url);
        const response = await route(url.pathname);
        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: String(error instanceof Error ? error.message : error),
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }
    },
  });

  return () => {
    server.stop(true);
  };
}

function startServer() {
  const state = getState();
  if (state.started) {
    return;
  }

  const host = DEFAULT_HOST;
  const port = Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 4649;

  try {
    if (typeof Bun !== "undefined" && typeof Bun.serve === "function") {
      state.stop = startBunServer(host, port);
      state.transport = "bun";
    } else {
      state.stop = startNodeServer(host, port);
      state.transport = "node";
    }
    state.started = true;
    console.log(`[opencode-streamdeck-stats] listening on http://${host}:${port} via ${state.transport}`);
  } catch (error) {
    state.started = false;
    state.stop = undefined;
    throw error;
  }
}

export default async function opencodeStreamdeckStatsPlugin() {
  startServer();
  return {};
}
