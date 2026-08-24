import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { PulseApiError } from "@pulse/api-client";
import { AppText, PrimaryButton, Screen } from "@/components/ui";
import { AppFont } from "@/constants/fonts";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === "authenticated") return <Redirect href="/today" />;
  if (auth.status === "needs-server") return <Redirect href="/server" />;
  const submit = async () => {
    setLoading(true); setError(null);
    try {
      if (registering) await auth.register(name, username, password);
      else await auth.login(username, password);
    } catch (value) {
      setError(value instanceof PulseApiError ? value.message : "Could not connect to Pulse. Check the server address and try again.");
    } finally { setLoading(false); }
  };

  const inputStyle = [styles.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }];
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.card, { width: Math.min(width - 40, 420) }]}>
            <View style={styles.brandRow}><Image source={require("@/assets/images/pulse-logo.png")} resizeMode="contain" style={styles.logoImage} /><AppText style={styles.logo}>Pulse</AppText></View>
            <AppText muted style={styles.subtitle}>Your tasks, everywhere.</AppText>
            <View style={styles.form}>
              {registering && <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={palette.textMuted} style={inputStyle} autoComplete="name" showSoftInputOnFocus={true} />}
              <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={palette.textMuted} style={inputStyle} autoCapitalize="none" autoCorrect={false} autoComplete="username" showSoftInputOnFocus={true} />
              <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={palette.textMuted} style={inputStyle} secureTextEntry autoComplete={registering ? "new-password" : "current-password"} showSoftInputOnFocus={true} onSubmitEditing={submit} />
              {error && <AppText style={[styles.error, { color: palette.danger }]}>{error}</AppText>}
              <PrimaryButton loading={loading} onPress={submit}>{registering ? "Create account" : "Sign in"}</PrimaryButton>
            </View>
            {auth.registrationEnabled && <Pressable onPress={() => { setRegistering((value) => !value); setError(null); }} style={styles.switch}>
              <AppText muted>{registering ? "Already have an account? " : "New to Pulse? "}<AppText style={{ color: palette.accent, fontWeight: "700" }}>{registering ? "Sign in" : "Create account"}</AppText></AppText>
            </Pressable>}
            <AppText muted style={styles.server}>Server: {auth.apiOrigin}</AppText>
            <Pressable onPress={async () => { await auth.disconnectServer(); router.replace("/server"); }} style={styles.changeServer}>
              <AppText style={{ color: palette.accent, fontWeight: "700" }}>Change or disconnect server</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { paddingVertical: 30 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10 }, logoImage: { width: 58, height: 47 }, logo: { fontSize: 38, fontWeight: "800", letterSpacing: -1.4 },
  subtitle: { fontSize: 16, marginTop: 5 }, form: { marginTop: 34, gap: 13 },
  input: { fontFamily: AppFont, height: 52, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 19 }, switch: { alignSelf: "center", marginTop: 24, padding: 8 },
  server: { fontSize: 11, textAlign: "center", marginTop: 15 }, changeServer: { alignSelf: "center", marginTop: 8, padding: 8 },
});
