import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function WidgetDeepLinkScreen() {
  const params = useLocalSearchParams<{ path?: string | string[] }>();
  const { status } = useAuth();
  const { palette } = useAppTheme();
  const segments = useMemo(() => Array.isArray(params.path) ? params.path : params.path ? params.path.split("/") : [], [params.path]);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status !== "authenticated" || !segments.length) return;
    const action = segments[0];
    const widgetAction = `${Date.now()}-${action}`;
    if (action === "add") {
      router.replace({ pathname: "/today", params: { create: "1", widgetAction } });
      return;
    }
    if (action === "task" && segments[1]) {
      router.replace({ pathname: "/today", params: { task: segments[1], widgetAction } });
      return;
    }
    if (action === "view") {
      const pathname = segments[1] === "inbox" ? "/inbox" : segments[1] === "upcoming" ? "/upcoming" : "/today";
      router.replace(pathname as never);
      return;
    }
    router.replace("/today");
  }, [segments, status]);

  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.background }}><ActivityIndicator color={palette.accent} /></View>;
}
