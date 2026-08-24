import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { PulseApiClient, PulseApiError, type MobileUser } from "@pulse/api-client";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { environmentApiOrigin, normalizeApiOrigin, queryCacheKey } from "@/lib/api-origin";

const TOKEN_KEY = "pulse.mobile.session";
const SERVER_ORIGIN_KEY = "pulse.mobile.server-origin";
const WIDGET_BASELINES_KEY = "pulse.widget-baselines-v2";
const PENDING_WIDGET_ACTIONS_KEY = "pulse.pending-widget-completions-v1";
let mobileAccessToken: string | null = null;
type AuthStatus = "loading" | "needs-server" | "authenticated" | "unauthenticated";

interface StoredSession { accessToken: string; expiresAt: string; user: MobileUser; }
interface AuthContextValue {
  api: PulseApiClient;
  status: AuthStatus;
  user: MobileUser | null;
  registrationEnabled: boolean;
  apiOrigin: string | null;
  suggestedApiOrigin: string | null;
  connectServer: (origin: string) => Promise<void>;
  disconnectServer: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getStoredSession(): Promise<string | null> {
  return Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredSession(value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value); else await AsyncStorage.removeItem(TOKEN_KEY);
  } else if (value) await SecureStore.setItemAsync(TOKEN_KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function clearServerSession(origin: string | null): Promise<void> {
  mobileAccessToken = null;
  await setStoredSession(null);
  await AsyncStorage.multiRemove([
    "pulse.query-cache",
    origin ? queryCacheKey(origin) : "",
    WIDGET_BASELINES_KEY,
    PENDING_WIDGET_ACTIONS_KEY,
  ].filter(Boolean));
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MobileUser | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [serverOrigin, setServerOrigin] = useState<string | null>(null);
  const api = useMemo(() => new PulseApiClient({
    baseUrl: serverOrigin ?? environmentApiOrigin ?? "http://127.0.0.1:3010",
    getAccessToken: async () => mobileAccessToken,
  }), [serverOrigin]);

  const establish = async (session: StoredSession) => {
    mobileAccessToken = session.accessToken;
    setUser(session.user);
    setStatus("authenticated");
    await setStoredSession(JSON.stringify(session));
  };

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SERVER_ORIGIN_KEY).then((raw) => {
      if (!alive) return;
      let origin: string | null = null;
      if (raw) {
        try { origin = normalizeApiOrigin(raw); } catch { /* A malformed saved value is treated as unconfigured. */ }
      }
      if (origin) setServerOrigin(origin);
      else { setUser(null); setStatus("needs-server"); }
    }).catch(() => { if (alive) setStatus("needs-server"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!serverOrigin) return;
    let alive = true;
    (async () => {
      try {
        const config = await api.getMobileAuthConfig();
        if (!alive) return;
        setRegistrationEnabled(config.registrationEnabled);
        if (config.authDisabled) {
          setUser({ id: "development", name: "Pulse", username: "development" });
          setStatus("authenticated");
          return;
        }
        const raw = await getStoredSession();
        if (!raw) { setStatus("unauthenticated"); return; }
        const session = JSON.parse(raw) as StoredSession;
        if (new Date(session.expiresAt) <= new Date()) throw new Error("Session expired");
        mobileAccessToken = session.accessToken;
        const current = await api.getMobileSession();
        if (!alive) return;
        setUser(current.user);
        setStatus("authenticated");
      } catch {
        mobileAccessToken = null;
        if (alive) { setUser(null); setStatus("unauthenticated"); }
        await setStoredSession(null).catch(() => undefined);
      }
    })();
    return () => { alive = false; };
  }, [api, serverOrigin]);

  const connectServer = async (input: string) => {
    const origin = normalizeApiOrigin(input);
    const candidate = new PulseApiClient({ baseUrl: origin, getAccessToken: async () => null });
    const config = await candidate.getMobileAuthConfig();
    await clearServerSession(serverOrigin);
    await AsyncStorage.setItem(SERVER_ORIGIN_KEY, origin);
    setUser(null);
    setRegistrationEnabled(config.registrationEnabled);
    setServerOrigin(origin);
    setStatus("loading");
  };

  const disconnectServer = async () => {
    await clearServerSession(serverOrigin);
    await AsyncStorage.removeItem(SERVER_ORIGIN_KEY);
    setServerOrigin(null);
    setRegistrationEnabled(false);
    setUser(null);
    setStatus("needs-server");
  };

  const login = async (username: string, password: string) => {
    if (!serverOrigin) throw new Error("Choose a Pulse server first.");
    await establish(await api.loginMobile({ username, password }));
  };

  const register = async (name: string, username: string, password: string) => {
    if (!serverOrigin) throw new Error("Choose a Pulse server first.");
    const response = await fetch(`${serverOrigin}/api/register`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new PulseApiError(response.status, "REGISTRATION_FAILED", data.error ?? "Could not create the account.");
    }
    await login(username, password);
  };

  const logout = async () => {
    mobileAccessToken = null;
    setUser(null);
    setStatus("unauthenticated");
    await setStoredSession(null);
  };

  const value = { api, status, user, registrationEnabled, apiOrigin: serverOrigin, suggestedApiOrigin: environmentApiOrigin, connectServer, disconnectServer, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
