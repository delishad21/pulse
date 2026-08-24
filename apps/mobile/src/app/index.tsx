import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function HomeScreen() {
  const { status } = useAuth();
  const { palette } = useAppTheme();
  if (status === "authenticated") return <Redirect href="/today" />;
  if (status === "needs-server") return <Redirect href="/server" />;
  if (status === "unauthenticated") return <Redirect href="/login" />;
  return (
    <View style={styles.container}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
