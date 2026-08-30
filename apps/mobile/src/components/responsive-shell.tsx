import { CalendarDays, Folder, Inbox, Settings, SunMedium } from "lucide-react-native";
import { router, usePathname, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { useAppTheme } from "@/providers/theme-provider";

const items = [
  { label: "Inbox", path: "/inbox", icon: Inbox },
  { label: "Today", path: "/today", icon: SunMedium },
  { label: "Upcoming", path: "/upcoming", icon: CalendarDays },
  { label: "Projects", path: "/projects", icon: Folder },
  { label: "Settings", path: "/settings", icon: Settings },
] as const;

export function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { palette } = useAppTheme();
  const pathname = usePathname();
  const wide = width >= 760;

  const nav = (compact: boolean) => items.map(({ label, path, icon: Icon }) => {
    const selected = pathname === path || (path === "/projects" && pathname.startsWith("/projects/"));
    return (
      <Pressable key={path} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.navigate(path as Href)} style={({ pressed }) => [
        compact ? styles.bottomItem : styles.sideItem,
        !compact && selected && { backgroundColor: palette.surface },
        pressed && { opacity: 0.65 },
      ]}>
        <Icon size={compact ? 22 : 19} color={selected ? palette.accent : palette.textMuted} strokeWidth={selected ? 2.3 : 1.8} />
        <Text numberOfLines={1} style={[compact ? styles.bottomLabel : styles.sideLabel, { color: selected ? palette.accent : palette.textMuted, fontFamily: selected ? AppFontBold : AppFont, fontWeight: selected ? "normal" : "500" }]}>{label}</Text>
      </Pressable>
    );
  });

  if (wide) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={[styles.wideRoot, { backgroundColor: palette.background }]}>
        <View style={[styles.sidebar, { borderRightColor: palette.border }]}>
          <View style={styles.brandRow}><Image source={require("@/assets/images/pulse-logo.png")} resizeMode="contain" style={styles.brandLogo} /><Text style={[styles.brand, { color: palette.text, fontFamily: AppFontBold }]}>Pulse</Text></View>
          <ScrollView contentContainerStyle={styles.sideNav}>{nav(false)}</ScrollView>
        </View>
        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.compactRoot, { backgroundColor: palette.background }]}>
      <View style={styles.content}>{children}</View>
      <SafeAreaView edges={["bottom"]} style={[styles.bottomBar, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
        {nav(true)}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wideRoot: { flex: 1, flexDirection: "row" },
  compactRoot: { flex: 1 },
  content: { flex: 1, minWidth: 0 },
  sidebar: { width: 224, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingTop: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 8, marginBottom: 26 }, brandLogo: { width: 40, height: 40 }, brand: { fontSize: 25, fontFamily: AppFontBold, fontWeight: "normal", letterSpacing: -0.8 },
  sideNav: { gap: 3 },
  sideItem: { height: 46, borderRadius: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 12 },
  sideLabel: { fontSize: 15 },
  bottomBar: { minHeight: 74, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  bottomItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2 },
  bottomLabel: { fontSize: 10.5 },
});
