import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

function developmentOrigin(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  // Metro can retain Android's emulator alias when the same dev server is then
  // used to launch iOS. That alias is not routable from the iOS simulator.
  if (Platform.OS === "ios" && host === "10.0.2.2") return "http://127.0.0.1:3010";
  // Android's emulator maps 10.0.2.2 to the development machine. A localhost
  // Metro URL otherwise makes API requests back to the emulator itself.
  if (Platform.OS === "android" && !Device.isDevice && (host === "127.0.0.1" || host === "localhost")) return "http://10.0.2.2:3010";
  if (host) return `http://${host}:3010`;
  if (Platform.OS === "android") return "http://10.0.2.2:3010";
  return "http://127.0.0.1:3010";
}

function platformOrigin(origin: string): string {
  const normalized = origin.replace(/\/$/, "");
  if (Platform.OS === "ios") return normalized.replace("//10.0.2.2", "//127.0.0.1");
  if (Platform.OS === "android" && !Device.isDevice) return normalized.replace("//127.0.0.1", "//10.0.2.2").replace("//localhost", "//10.0.2.2");
  return normalized;
}

/**
 * An optional development-time hint. Production builds intentionally leave
 * this unset so the server connection screen can target any Pulse instance.
 */
export const environmentApiOrigin = process.env.EXPO_PUBLIC_PULSE_API_URL
  ? platformOrigin(process.env.EXPO_PUBLIC_PULSE_API_URL)
  : (__DEV__ ? developmentOrigin() : null);

export function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Enter a server URL.");
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { throw new Error("Enter a complete URL, including http:// or https://."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The server URL must use http:// or https://.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Enter only the server address, without credentials or query parameters.");
  }
  return parsed.toString().replace(/\/$/, "");
}

/** Keep persisted query caches isolated when a user switches servers. */
export function queryCacheKey(apiOrigin: string | null): string {
  return `pulse.query-cache:${encodeURIComponent(apiOrigin ?? "unconfigured")}`;
}
