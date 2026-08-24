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

export const pulseApiOrigin = platformOrigin(process.env.EXPO_PUBLIC_PULSE_API_URL || developmentOrigin());
