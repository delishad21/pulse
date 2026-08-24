import type { Priority } from "@pulse/domain";

export const lightPalette = {
  background: "#ffffff",
  surface: "#f7f7f8",
  surfaceRaised: "#ffffff",
  text: "#202124",
  textMuted: "#77787d",
  border: "#e7e7e9",
  accent: "#dc4c3e",
  accentSoft: "#fff0ee",
  danger: "#d34b45",
  dangerSoft: "#fff0ef",
  success: "#2f8b57",
  overlay: "rgba(17, 18, 20, 0.42)",
  backgroundElement: "#f7f7f8",
  backgroundSelected: "#fff0ee",
  textSecondary: "#77787d",
};

export const darkPalette = {
  background: "#151516",
  surface: "#202022",
  surfaceRaised: "#29292c",
  text: "#f5f5f6",
  textMuted: "#a1a1a7",
  border: "#36363a",
  accent: "#dc4c3e",
  accentSoft: "rgba(220, 76, 62, 0.16)",
  danger: "#ff817a",
  dangerSoft: "#422624",
  success: "#6bc78e",
  overlay: "rgba(0, 0, 0, 0.64)",
  backgroundElement: "#202022",
  backgroundSelected: "rgba(220, 76, 62, 0.16)",
  textSecondary: "#a1a1a7",
};

export type Palette = typeof lightPalette;
export type ThemePreference = "system" | "light" | "dark";

export const priorityColors: Record<Priority, string> = {
  none: "#96969d",
  low: "#4a8fe7",
  medium: "#d7a528",
  high: "#e2783e",
  urgent: "#dc4f49",
};

export const projectColors = [
  "#dc4c3e", "#7c3aed", "#c2418c", "#dc4f49", "#e2783e",
  "#d7a528", "#2f8b57", "#16868d", "#4f6f91", "#77787d",
] as const;
