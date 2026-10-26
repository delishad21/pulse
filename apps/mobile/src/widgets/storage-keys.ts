export const WIDGET_BASELINES_KEY = "pulse.widget-baselines-v2";
export const WIDGET_COMPLETIONS_KEY = "pulse.widget-completions-v2";
/** Plain list of unsent ticks written by earlier app versions; migrated on first read. */
export const LEGACY_PENDING_COMPLETIONS_KEY = "pulse.pending-widget-completions-v1";
export const WIDGET_PUSH_TOKEN_KEY = "pulse.widget-push-token";

/** Per-account widget state, cleared when the phone switches servers. */
export const WIDGET_STATE_KEYS = [WIDGET_BASELINES_KEY, WIDGET_COMPLETIONS_KEY, LEGACY_PENDING_COMPLETIONS_KEY, WIDGET_PUSH_TOKEN_KEY];
