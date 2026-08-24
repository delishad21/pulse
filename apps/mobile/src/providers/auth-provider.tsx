import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { PulseApiClient, PulseApiError, type MobileUser } from "@pulse/api-client";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { pulseApiOrigin } from "@/lib/api-origin";

const TOKEN_KEY = "pulse.mobile.session";
let mobileAccessToken: string | null = null;
const mobileApi = new PulseApiClient({ baseUrl: pulseApiOrigin, getAccessToken: async () => mobileAccessToken });
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface StoredSession { accessToken: string; expiresAt: string; user: MobileUser; }
interface AuthContextValue {
  api: PulseApiClient;
  status: AuthStatus;
  user: MobileUser | null;
  registrationEnabled: boolean;
  apiOrigin: string;
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MobileUser | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const api = mobileApi;

  const establish = async (session: StoredSession) => {
    mobileAccessToken = session.accessToken;
    setUser(session.user);
    setStatus("authenticated");
    await setStoredSession(JSON.stringify(session));
  };

  useEffect(() => {
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
  }, [api]);

  const login = async (username: string, password: string) => {
    await establish(await api.loginMobile({ username, password }));
  };

  const register = async (name: string, username: string, password: string) => {
    const response = await fetch(`${pulseApiOrigin}/api/register`, {
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

  const value = { api, status, user, registrationEnabled, apiOrigin: pulseApiOrigin, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
