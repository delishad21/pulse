import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { PulseApiError } from "@pulse/api-client";
import { AppText, PrimaryButton, Screen } from "@/components/ui";
import { AppFont } from "@/constants/fonts";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function ServerScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const [origin, setOrigin] = useState(auth.apiOrigin ?? auth.suggestedApiOrigin ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      await auth.connectServer(origin);
      router.replace("/login");
    } catch (value) {
      if (value instanceof PulseApiError) setError(value.message);
      else if (value instanceof Error) setError(value.message);
      else setError("Could not reach that Pulse server. Check the URL and your connection.");
    } finally { setLoading(false); }
  };

  const disconnect = async () => {
    await auth.disconnectServer();
    setOrigin("");
    setError(null);
  };

  const inputStyle = [styles.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }];
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { width: Math.min(width - 40, 420) }]}>
            <View style={styles.brandRow}><Image source={require("@/assets/images/pulse-logo.png")} resizeMode="contain" style={styles.logoImage} /><AppText style={styles.logo}>Pulse</AppText></View>
            <AppText style={styles.heading}>Connect to your server</AppText>
            <AppText muted style={styles.subtitle}>Choose the Pulse instance you want to use. Your choice is saved on this device and can be changed from the login screen.</AppText>
            <View style={styles.form}>
              <TextInput
                value={origin}
                onChangeText={(value) => { setOrigin(value); setError(null); }}
                placeholder="https://pulse.example.com"
                placeholderTextColor={palette.textMuted}
                style={inputStyle}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={!auth.apiOrigin}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={connect}
              />
              {error && <AppText style={[styles.error, { color: palette.danger }]}>{error}</AppText>}
              <PrimaryButton loading={loading} onPress={connect} disabled={!origin.trim()}>Connect</PrimaryButton>
            </View>
            {auth.apiOrigin && <Pressable onPress={disconnect} style={styles.disconnect}>
              <AppText style={{ color: palette.danger, fontWeight: "700" }}>Disconnect saved server</AppText>
            </Pressable>}
            <AppText muted style={styles.detail}>Use http:// for a local network server and https:// for an internet-facing server.</AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { paddingVertical: 30 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 58, height: 47 },
  logo: { fontSize: 38, fontWeight: "800", letterSpacing: -1.4 },
  heading: { fontSize: 24, fontWeight: "700", marginTop: 32 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 7 },
  form: { marginTop: 24, gap: 13 },
  input: { fontFamily: AppFont, height: 52, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 19 },
  disconnect: { alignSelf: "center", marginTop: 22, padding: 8 },
  detail: { fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 17 },
});
