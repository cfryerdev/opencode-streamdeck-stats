import streamDeck, {
  action,
  SingletonAction,
  type KeyAction,
  type JsonObject,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
} from "@elgato/streamdeck";
import { OpenCodeClient, DEFAULT_SERVER_URL, type Stats } from "../api";

export type StatType =
  | "totalCost"
  | "costPerDay"
  | "costThisMonth"
  | "inputTokens"
  | "outputTokens"
  | "reasoningTokens"
  | "cacheRead"
  | "cacheWrite"
  | "activeSessions"
  | "totalSessions"
  | "tokensPerSession";

export interface StatsSettings extends JsonObject {
  serverUrl?: string;
  refreshInterval?: number | string;
  showLabel?: boolean | string;
  valueFontSize?: number | string;
  labelSize?: number | string;
  costPeriod?: string;
}

const DEFAULT_INTERVAL = 60;
const MIN_INTERVAL = 10;
const DEFAULT_VALUE_FONT_SIZE = 30;
const MIN_VALUE_FONT_SIZE = 20;
const MAX_VALUE_FONT_SIZE = 52;
const DEFAULT_LABEL_SIZE = 18;
const MIN_LABEL_SIZE = 10;
const MAX_LABEL_SIZE = 28;

interface StatVisualMeta {
  label: string;
}

interface ActionRuntime {
  timer?: NodeJS.Timeout;
  inFlight: boolean;
  lastImage?: string;
  lastTitle?: string;
  hadError: boolean;
  defaultsApplied: boolean;
}

const STAT_META: Record<StatType, StatVisualMeta> = {
  totalCost: { label: "Total Cost" },
  costPerDay: { label: "Cost / Day" },
  costThisMonth: { label: "Cost (Month)" },
  inputTokens: { label: "Input Tokens" },
  outputTokens: { label: "Output Tokens" },
  reasoningTokens: { label: "Reasoning Tokens" },
  cacheRead: { label: "Cache Read" },
  cacheWrite: { label: "Cache Write" },
  activeSessions: { label: "Active Sessions" },
  totalSessions: { label: "Total Sessions" },
  tokensPerSession: { label: "Tokens / Session" },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function getCostPeriod(settings: StatsSettings): "day" | "month" {
  return settings.costPeriod === "month" ? "month" : "day";
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderKeyImage(
  label: string,
  value: string,
  isError: boolean,
  valueSize: number,
  showLabel: boolean,
  labelSize: number,
): string {
  const valueColor = isError ? "#FECACA" : "#F8FAFC";
  const labelColor = isError ? "#FCA5A5" : "#CFCECD";
  const lineColor = isError ? "#F87171" : "#CFCECD";
  const logoOpacity = isError ? "0.16" : "0.24";
  const safeValue = escapeXml(value);
  const safeLabel = escapeXml(label);
  const valueY = showLabel ? 83 : 90;
  const lineY = showLabel ? 99 : 104;
  const labelY = showLabel ? 122 : 0;
  const lineNode = showLabel
    ? `<rect x="16" y="${lineY}" width="112" height="3" rx="2" fill="${lineColor}" fill-opacity="0.34"/>`
    : "";
  const labelNode = showLabel
    ? `<text x="72" y="${labelY}" fill="${labelColor}" font-size="${labelSize}" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-weight="600">${safeLabel}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#151821"/><stop offset="100%" stop-color="#242432"/></linearGradient></defs><rect width="144" height="144" rx="18" fill="url(#g)"/><rect x="8" y="8" width="128" height="128" rx="14" fill="#000000" fill-opacity="0.2" stroke="#FFFFFF" stroke-opacity="0.12"/><path d="M28 18h88v108H28V18Zm22 32v44h44V50H50Z" transform="translate(72 72) scale(0.81) translate(-72 -72)" fill="#F1ECEC" fill-opacity="${logoOpacity}" fill-rule="evenodd"/><text x="72" y="${valueY}" fill="${valueColor}" font-size="${valueSize}" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-weight="700">${safeValue}</text>${lineNode}${labelNode}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getStatValue(stats: Stats, type: StatType): string {
  switch (type) {
    case "totalCost":
      return formatCost(stats.totalCost);
    case "costPerDay":
      return formatCost(stats.costLastDay);
    case "costThisMonth":
      return formatCost(stats.costThisMonth);
    case "inputTokens":
      return formatNumber(stats.inputTokens);
    case "outputTokens":
      return formatNumber(stats.outputTokens);
    case "reasoningTokens":
      return formatNumber(stats.reasoningTokens);
    case "cacheRead":
      return formatNumber(stats.cacheRead);
    case "cacheWrite":
      return formatNumber(stats.cacheWrite);
    case "activeSessions":
      return String(stats.activeSessions);
    case "totalSessions":
      return String(stats.totalSessions);
    case "tokensPerSession":
      return formatNumber(stats.tokensPerSession);
  }
}

function getCostAwareLabel(meta: StatVisualMeta, type: StatType, settings: StatsSettings): string {
  if (type === "costPerDay") {
    return getCostPeriod(settings) === "month" ? "Cost (30d)" : "Cost (24h)";
  }

  return meta.label;
}

abstract class StatsActionBase extends SingletonAction<StatsSettings> {
  abstract readonly statType: StatType;

  private runtime = new Map<string, ActionRuntime>();

  private getRuntime(actionID: string): ActionRuntime {
    let state = this.runtime.get(actionID);
    if (!state) {
      state = { inFlight: false, hadError: false, defaultsApplied: false };
      this.runtime.set(actionID, state);
    }
    return state;
  }

  private getInterval(settings: StatsSettings): number {
    const interval = Number(settings.refreshInterval ?? DEFAULT_INTERVAL);
    if (!Number.isFinite(interval)) {
      return DEFAULT_INTERVAL;
    }
    return Math.max(MIN_INTERVAL, Math.round(interval));
  }

  private getUrl(settings: StatsSettings): string {
    return settings.serverUrl?.trim() || DEFAULT_SERVER_URL;
  }

  private shouldShowLabel(settings: StatsSettings): boolean {
    if (settings.showLabel === undefined || settings.showLabel === null) {
      return true;
    }

    if (typeof settings.showLabel === "string") {
      return settings.showLabel !== "false";
    }

    return Boolean(settings.showLabel);
  }

  private getValueFontSize(settings: StatsSettings, value: string): number {
    void value;
    const raw = settings.valueFontSize;
    const parsed = typeof raw === "string" ? Number(raw) : raw;

    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
      return DEFAULT_VALUE_FONT_SIZE;
    }

    return Math.max(MIN_VALUE_FONT_SIZE, Math.min(MAX_VALUE_FONT_SIZE, Math.round(parsed)));
  }

  private getLabelSize(settings: StatsSettings): number {
    const raw = settings.labelSize;
    const parsed = typeof raw === "string" ? Number(raw) : raw;

    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
      return DEFAULT_LABEL_SIZE;
    }

    return Math.max(MIN_LABEL_SIZE, Math.min(MAX_LABEL_SIZE, Math.round(parsed)));
  }

  private async applyDefaultSettings(action: KeyAction<StatsSettings>, settings: StatsSettings): Promise<StatsSettings> {
    const next: StatsSettings = { ...settings };
    let changed = false;

    if (next.showLabel === undefined || next.showLabel === null) {
      next.showLabel = true;
      changed = true;
    }

    if (next.valueFontSize === undefined || next.valueFontSize === null || next.valueFontSize === "") {
      next.valueFontSize = DEFAULT_VALUE_FONT_SIZE;
      changed = true;
    }

    if (next.labelSize === undefined || next.labelSize === null || next.labelSize === "") {
      next.labelSize = DEFAULT_LABEL_SIZE;
      changed = true;
    }

    if (next.refreshInterval === undefined || next.refreshInterval === null || next.refreshInterval === "") {
      next.refreshInterval = DEFAULT_INTERVAL;
      changed = true;
    }

    if (next.costPeriod === undefined || next.costPeriod === null || next.costPeriod === "") {
      next.costPeriod = "day";
      changed = true;
    }

    if (changed) {
      await action.setSettings(next);
    }

    return next;
  }

  private async applyView(action: KeyAction<StatsSettings>, image: string, title: string): Promise<void> {
    const state = this.getRuntime(action.id);

    if (state.lastImage !== image) {
      await action.setImage(image);
      state.lastImage = image;
    }

    if (state.lastTitle !== title) {
      await action.setTitle(title);
      state.lastTitle = title;
    }
  }

  private async refresh(action: KeyAction<StatsSettings>): Promise<void> {
    const state = this.getRuntime(action.id);
    if (state.inFlight) {
      return;
    }

    state.inFlight = true;
    let settings = await action.getSettings();
    if (!state.defaultsApplied) {
      settings = await this.applyDefaultSettings(action, settings);
      state.defaultsApplied = true;
    }

    const url = this.getUrl(settings);
    const meta = STAT_META[this.statType];
    const showLabel = this.shouldShowLabel(settings);
    const label = getCostAwareLabel(meta, this.statType, settings);
    const title = "";
    const labelSize = this.getLabelSize(settings);

    try {
      const client = new OpenCodeClient(url);
      const stats = await client.getStats();
      const value =
        this.statType === "costPerDay" && getCostPeriod(settings) === "month"
          ? formatCost(stats.costLast30Days)
          : getStatValue(stats, this.statType);
      const image = renderKeyImage(
        label,
        value,
        false,
        this.getValueFontSize(settings, value),
        showLabel,
        labelSize,
      );
      await this.applyView(action, image, title);

      if (state.hadError) {
        streamDeck.logger.info(`Recovered opencode stats for ${meta.label} from ${url}`);
      }
      state.hadError = false;
    } catch (err) {
      const image = renderKeyImage(
        label,
        "ERR",
        true,
        this.getValueFontSize(settings, "ERR"),
        showLabel,
        labelSize,
      );
      await this.applyView(action, image, title);

      if (!state.hadError) {
        streamDeck.logger.error(`Failed to fetch opencode stats from ${url}: ${err}`);
      }
      state.hadError = true;
    } finally {
      state.inFlight = false;
    }
  }

  private startPolling(action: KeyAction<StatsSettings>, settings: StatsSettings): void {
    this.stopPolling(action);
    void this.refresh(action);
    const interval = this.getInterval(settings);
    const state = this.getRuntime(action.id);
    state.timer = setInterval(() => {
      void this.refresh(action);
    }, interval * 1000);
  }

  private stopPolling(action: { id: string }): void {
    const state = this.runtime.get(action.id);
    const timer = state?.timer;
    if (timer) {
      clearInterval(timer);
      if (state) {
        state.timer = undefined;
      }
    }
  }

  override onWillAppear(ev: WillAppearEvent<StatsSettings>): Promise<void> | void {
    if (ev.action.isKey()) {
      this.startPolling(ev.action, ev.payload.settings);
    }
  }

  override onWillDisappear(ev: WillDisappearEvent<StatsSettings>): Promise<void> | void {
    this.stopPolling(ev.action);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<StatsSettings>): Promise<void> | void {
    if (ev.action.isKey()) {
      this.startPolling(ev.action, ev.payload.settings);
    }
  }

  override onKeyDown(ev: KeyDownEvent<StatsSettings>): Promise<void> | void {
    this.refresh(ev.action);
  }
}

@action({ UUID: "com.chrisfryer.opencode-stats.total-cost" })
export class TotalCostAction extends StatsActionBase {
  readonly statType = "totalCost" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.cost-per-day" })
export class CostPerDayAction extends StatsActionBase {
  readonly statType = "costPerDay" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.cost-this-month" })
export class CostThisMonthAction extends StatsActionBase {
  readonly statType = "costThisMonth" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.input-tokens" })
export class InputTokensAction extends StatsActionBase {
  readonly statType = "inputTokens" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.output-tokens" })
export class OutputTokensAction extends StatsActionBase {
  readonly statType = "outputTokens" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.reasoning-tokens" })
export class ReasoningTokensAction extends StatsActionBase {
  readonly statType = "reasoningTokens" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.cache-read" })
export class CacheReadAction extends StatsActionBase {
  readonly statType = "cacheRead" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.cache-write" })
export class CacheWriteAction extends StatsActionBase {
  readonly statType = "cacheWrite" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.active-sessions" })
export class ActiveSessionsAction extends StatsActionBase {
  readonly statType = "activeSessions" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.total-sessions" })
export class TotalSessionsAction extends StatsActionBase {
  readonly statType = "totalSessions" as const;
}

@action({ UUID: "com.chrisfryer.opencode-stats.tokens-per-session" })
export class TokensPerSessionAction extends StatsActionBase {
  readonly statType = "tokensPerSession" as const;
}
