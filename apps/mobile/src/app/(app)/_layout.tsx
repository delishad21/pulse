import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { ResponsiveShell } from "@/components/responsive-shell";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";
import { WidgetBridge } from "@/widgets/widget-bridge";

export default function AppLayout() {
  const { status } = useAuth();
  const { palette } = useAppTheme();
  if (status === "unauthenticated") return <Redirect href="/login" />;
  if (status === "loading") return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={palette.accent} /></View>;
  return <ResponsiveShell><WidgetBridge /><Slot /></ResponsiveShell>;
}
