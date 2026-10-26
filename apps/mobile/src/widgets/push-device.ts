import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { PulseApiClient } from "@pulse/api-client";
import { WIDGET_PUSH_TOKEN_KEY } from "./storage-keys";

/**
 * Register this phone for the server's silent "refresh your widgets" pushes.
 * Silent (iOS content-available / Android data-only) pushes need no
 * notification permission, so this never prompts; reminder alerts still need
 * the permission asked for in Reminder settings.
 */
export async function registerWidgetPushDevice(api: PulseApiClient): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.registerPushDevice(token, Platform.OS === "ios" ? "ios" : "android");
  await AsyncStorage.setItem(WIDGET_PUSH_TOKEN_KEY, token);
}

export async function unregisterWidgetPushDevice(api: PulseApiClient): Promise<void> {
  const token = await AsyncStorage.getItem(WIDGET_PUSH_TOKEN_KEY);
  if (!token) return;
  await api.unregisterPushDevice(token);
  await AsyncStorage.removeItem(WIDGET_PUSH_TOKEN_KEY);
}
