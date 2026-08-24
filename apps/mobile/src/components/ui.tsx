import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { useAppTheme } from "@/providers/theme-provider";

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useAppTheme();
  return <View style={[styles.screen, { backgroundColor: palette.background }, style]}>{children}</View>;
}

export function AppText({ children, muted, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { palette } = useAppTheme();
  const flattenedStyle = StyleSheet.flatten(style) ?? {};
  const weight = flattenedStyle.fontWeight;
  const isBold = weight === "bold" || (typeof weight === "number" && weight >= 600) || (typeof weight === "string" && /^[6-9]00$/.test(weight));
  const requestedFamily = flattenedStyle.fontFamily;
  const useBundledBold = isBold && (!requestedFamily || requestedFamily === AppFont);
  const useExplicitBundledBold = requestedFamily === AppFontBold;
  const normalizeBundledBold = useBundledBold || useExplicitBundledBold;
  const fontFamily = normalizeBundledBold ? AppFontBold : requestedFamily ?? AppFont;
  // expo-font registers each Android face under its own family alias at the
  // normal weight.  Leaving a caller's `fontWeight: 700` in place makes
  // React Native look for a second bold face and silently fall back to the
  // system font.  The bundled Product Sans Bold file is already bold, so
  // explicitly use it at normal weight and apply this last in the style list.
  const fontOverride = normalizeBundledBold ? { fontFamily: AppFontBold, fontWeight: "normal" as const } : { fontFamily };
  return <Text numberOfLines={numberOfLines} style={[{ color: muted ? palette.textMuted : palette.text }, style, fontOverride]}>{children}</Text>;
}

export function IconButton({ icon: Icon, label, size = 20, style, ...props }: PressableProps & { icon: LucideIcon; label: string; size?: number }) {
  const { palette } = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? palette.surface : "transparent" }, style as ViewStyle]} {...props}>
      <Icon size={size} color={palette.textMuted} strokeWidth={1.9} />
    </Pressable>
  );
}

export function PrimaryButton({ children, loading, style, ...props }: PressableProps & { children: React.ReactNode; loading?: boolean }) {
  const { palette } = useAppTheme();
  return (
    <Pressable disabled={loading || props.disabled} style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent, opacity: pressed || loading || props.disabled ? 0.72 : 1 }, style as ViewStyle]} {...props}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{children}</Text>}
    </Pressable>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <AppText style={styles.emptyTitle}>{title}</AppText>
      <AppText muted style={styles.emptyDetail}>{detail}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  primaryButton: { minHeight: 48, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#fff", fontFamily: AppFontBold, fontSize: 16, fontWeight: "normal" },
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 54 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyDetail: { fontSize: 14, textAlign: "center", lineHeight: 20, marginTop: 6, maxWidth: 340 },
});
