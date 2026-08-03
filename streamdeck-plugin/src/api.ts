import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_SERVER_URL = "http://127.0.0.1:4096";
export const DEFAULT_PLUGIN_STATS_URL = "http://127.0.0.1:4649/stats";

const execFileAsync = promisify(execFile);
const DEFAULT_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

export interface SessionTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

export interface SessionTime {
  created: number;
  updated: number;
  archived?: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  parentID?: string | null;
  model?: string;
  agent?: string;
  cost: number;
  tokens: SessionTokens;
  time: SessionTime;
  projectID?: string;
}

export interface Stats {
  totalCost: number;
  costPerDay: number;
  costLastDay: number;
  costLast30Days: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cacheWrite: number;
  activeSessions: number;
  totalSessions: number;
  tokensPerSession: number;
}

interface PluginStatsResponse {
  ok?: boolean;
  stats?: Partial<Stats>;
}

export class OpenCodeClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_SERVER_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`opencode API ${path} returned ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private normalizeSessions(payload: unknown): SessionInfo[] {
    if (Array.isArray(payload)) {
      return payload as SessionInfo[];
    }

    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      if (Array.isArray(p["data"])) {
        return p["data"] as SessionInfo[];
      }
      if (Array.isArray(p["items"])) {
        return p["items"] as SessionInfo[];
      }
    }

    return [];
  }

  private normalizeStats(payload: Partial<Stats>): Stats {
    const asNumber = (value: unknown): number => {
      const parsed = typeof value === "number" ? value : Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      totalCost: asNumber(payload.totalCost),
      costPerDay: asNumber(payload.costPerDay),
      costLastDay: asNumber(payload.costLastDay),
      costLast30Days: asNumber(payload.costLast30Days),
      inputTokens: asNumber(payload.inputTokens),
      outputTokens: asNumber(payload.outputTokens),
      reasoningTokens: asNumber(payload.reasoningTokens),
      cacheRead: asNumber(payload.cacheRead),
      cacheWrite: asNumber(payload.cacheWrite),
      activeSessions: asNumber(payload.activeSessions),
      totalSessions: asNumber(payload.totalSessions),
      tokensPerSession: asNumber(payload.tokensPerSession),
    };
  }

  private async getStatsFromPluginService(): Promise<Stats> {
    const url = process.env.OPENCODE_STREAMDECK_STATS_URL?.trim() || DEFAULT_PLUGIN_STATS_URL;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`opencode plugin stats endpoint returned ${res.status}`);
    }

    const payload = (await res.json()) as PluginStatsResponse | Partial<Stats>;
    const stats =
      payload && typeof payload === "object" && "stats" in payload
        ? (payload as PluginStatsResponse).stats
        : (payload as Partial<Stats>);

    if (!stats || typeof stats !== "object") {
      throw new Error("opencode plugin stats endpoint returned invalid payload");
    }

    return this.normalizeStats(stats);
  }

  private async getStatsFromLocalDb(): Promise<Stats> {
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
    const rows = JSON.parse(stdout || "[]") as Array<{
      total_cost?: number;
      input_tokens?: number;
      output_tokens?: number;
      reasoning_tokens?: number;
      cache_read?: number;
      cache_write?: number;
      cost_last_day?: number;
      cost_last_30_days?: number;
      total_sessions?: number;
      active_sessions?: number;
      earliest_created?: number;
      latest_updated?: number;
    }>;

    const row = rows[0] ?? {};

    const totalCost = row.total_cost ?? 0;
    const inputTokens = row.input_tokens ?? 0;
    const outputTokens = row.output_tokens ?? 0;
    const reasoningTokens = row.reasoning_tokens ?? 0;
    const cacheRead = row.cache_read ?? 0;
    const cacheWrite = row.cache_write ?? 0;
    const costLastDay = row.cost_last_day ?? 0;
    const costLast30Days = row.cost_last_30_days ?? 0;
    const totalSessions = row.total_sessions ?? 0;
    const activeSessions = row.active_sessions ?? 0;
    const earliestCreated = row.earliest_created ?? 0;
    const latestUpdated = row.latest_updated ?? 0;

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

  async getSessions(): Promise<SessionInfo[]> {
    const payload = await this.get<unknown>("/api/session");
    return this.normalizeSessions(payload);
  }

  async getActiveSessions(): Promise<SessionInfo[]> {
    const payload = await this.get<unknown>("/api/session/active");
    return this.normalizeSessions(payload);
  }

  async getStats(): Promise<Stats> {
    try {
      return await this.getStatsFromPluginService();
    } catch {
      // Fall through to local-only strategies.
    }

    try {
      return await this.getStatsFromLocalDb();
    } catch {
      // Fall back to local API when sqlite is unavailable.
    }

    try {
      const [sessions, active] = await Promise.all([
        this.getSessions(),
        this.getActiveSessions().catch(() => [] as SessionInfo[]),
      ]);

      return computeStats(
        sessions,
        active.filter((session) => !hasParent(session)).length,
      );
    } catch {
      throw new Error("Unable to fetch stats from sqlite and API");
    }
  }
}

function hasParent(session: SessionInfo): boolean {
  const s = session as SessionInfo & { parent_id?: string | null };
  return Boolean(session.parentID || s.parent_id);
}

export function computeStats(sessions: SessionInfo[], activeCount: number): Stats {
  let totalCost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let costLastDay = 0;
  let costLast30Days = 0;
  let earliestCreated = Infinity;
  let latestUpdated = -Infinity;
  let rootCount = 0;
  const now = Date.now();
  const oneDayAgo = now - 86_400_000;
  const thirtyDaysAgo = now - 30 * 86_400_000;

  for (const s of sessions) {
    if (hasParent(s)) {
      continue;
    }

    rootCount += 1;
    totalCost += s.cost ?? 0;
    inputTokens += s.tokens?.input ?? 0;
    outputTokens += s.tokens?.output ?? 0;
    reasoningTokens += s.tokens?.reasoning ?? 0;
    cacheRead += s.tokens?.cache?.read ?? 0;
    cacheWrite += s.tokens?.cache?.write ?? 0;
    if ((s.time?.updated ?? 0) >= oneDayAgo) {
      costLastDay += s.cost ?? 0;
    }
    if ((s.time?.updated ?? 0) >= thirtyDaysAgo) {
      costLast30Days += s.cost ?? 0;
    }
    if (s.time?.created) earliestCreated = Math.min(earliestCreated, s.time.created);
    if (s.time?.updated) latestUpdated = Math.max(latestUpdated, s.time.updated);
  }

  const totalTokens = inputTokens + outputTokens + reasoningTokens + cacheRead + cacheWrite;
  const tokensPerSession = rootCount > 0 ? Math.round(totalTokens / rootCount) : 0;

  let days = 1;
  if (earliestCreated !== Infinity && latestUpdated !== -Infinity) {
    days = Math.max(1, Math.ceil((latestUpdated - earliestCreated) / 86_400_000));
  }
  const costPerDay = totalCost / days;

  return {
    totalCost,
    costPerDay,
    costLastDay,
    costLast30Days,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheRead,
    cacheWrite,
    activeSessions: Math.max(0, activeCount),
    totalSessions: rootCount,
    tokensPerSession,
  };
}
