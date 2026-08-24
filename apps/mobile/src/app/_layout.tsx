import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";
import { queryCacheKey } from "@/lib/api-origin";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ProductSans: require("../../assets/fonts/ProductSans-Regular.ttf"),
    ProductSansBold: require("../../assets/fonts/ProductSans-Bold.ttf"),
    ProductSansItalic: require("../../assets/fonts/ProductSans-Italic.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider><QueryBridge /></AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function QueryBridge() {
  const { apiOrigin } = useAuth();
  const cacheKey = queryCacheKey(apiOrigin);
  return <QueryProvider key={cacheKey} storageKey={cacheKey}><RootNavigator /></QueryProvider>;
}

function RootNavigator() {
  const { isDark, palette } = useAppTheme();
  return <><StatusBar style={isDark ? "light" : "dark"} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background }, animation: "fade" }} /></>;
}
