import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { PulseApiClient, type MobileUser } from "@pulse/api-client";
import { normalizeApiOrigin } from "@/lib/api-origin";

/**
 * Session storage shared by the AuthProvider and headless JS (background
 * tasks and silent pushes), which run without the React tree. The token is
 * stored with AFTER_FIRST_UNLOCK so background work can read it while the
 * phone is locked.
 */
export const TOKEN_KEY = "pulse.mobile.session";
export const SERVER_ORIGIN_KEY = "pulse.mobile.server-origin";

export interface StoredSession { accessToken: string; expiresAt: string; user: MobileUser; }

export async function getStoredSession(): Promise<string | null> {
  return Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredSession(value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value); else await AsyncStorage.removeItem(TOKEN_KEY);
  } else if (value) await SecureStore.setItemAsync(TOKEN_KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function loadServerOrigin(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(SERVER_ORIGIN_KEY);
  if (!raw) return null;
  try { return normalizeApiOrigin(raw); } catch { return null; }
}

/**
 * An API client for headless JS, or null when the phone is not signed in.
 * Never clears or renews the session: a rejected token is left for the app to
 * handle the next time it opens.
 */
export async function createHeadlessApi(): Promise<PulseApiClient | null> {
  const origin = await loadServerOrigin();
  if (!origin) return null;
  let session: StoredSession | null = null;
  try {
    const raw = await getStoredSession();
    if (raw) session = JSON.parse(raw) as StoredSession;
  } catch { /* Unreadable (e.g. before first unlock): treat as signed out for this run. */ }
  const token = session?.accessToken;
  if (token) return new PulseApiClient({ baseUrl: origin, getAccessToken: async () => token });
  // Development servers can run without auth; everything else needs a session.
  const anonymous = new PulseApiClient({ baseUrl: origin, getAccessToken: async () => null });
  const config = await anonymous.getMobileAuthConfig().catch(() => null);
  return config?.authDisabled ? anonymous : null;
}
