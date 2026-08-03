import streamDeck from "@elgato/streamdeck";
import {
  TotalCostAction,
  CostPerDayAction,
  CostThisMonthAction,
  InputTokensAction,
  OutputTokensAction,
  ReasoningTokensAction,
  CacheReadAction,
  CacheWriteAction,
  ActiveSessionsAction,
  TotalSessionsAction,
  TokensPerSessionAction,
} from "./actions/stats";

streamDeck.actions.registerAction(new TotalCostAction());
streamDeck.actions.registerAction(new CostPerDayAction());
streamDeck.actions.registerAction(new CostThisMonthAction());
streamDeck.actions.registerAction(new InputTokensAction());
streamDeck.actions.registerAction(new OutputTokensAction());
streamDeck.actions.registerAction(new ReasoningTokensAction());
streamDeck.actions.registerAction(new CacheReadAction());
streamDeck.actions.registerAction(new CacheWriteAction());
streamDeck.actions.registerAction(new ActiveSessionsAction());
streamDeck.actions.registerAction(new TotalSessionsAction());
streamDeck.actions.registerAction(new TokensPerSessionAction());

streamDeck.logger.info("opencode Stats plugin starting");
streamDeck.connect();
