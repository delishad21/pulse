import { Platform } from "react-native";
import { darkPalette, lightPalette } from "./palette";

export const Colors = { light: lightPalette, dark: darkPalette } as const;
export type ThemeColor = keyof typeof lightPalette;
export const Fonts = Platform.select({ ios: { sans: "system-ui", serif: "ui-serif", rounded: "ui-rounded", mono: "ui-monospace" }, default: { sans: "normal", serif: "serif", rounded: "normal", mono: "monospace" } });
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
