import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

interface NativePulseWidgets { updateSnapshot(view: string, snapshot: string): Promise<void>; reloadAll(): Promise<void>; consumeCompletedTaskIds(): Promise<string[]>; }
const native = Platform.OS === "android" ? requireOptionalNativeModule<NativePulseWidgets>("PulseAndroidWidgets") : null;

export async function updateAndroidWidgetSnapshot(view: string, snapshot: object): Promise<void> {
  await native?.updateSnapshot(view, JSON.stringify(snapshot));
}

export async function reloadAndroidWidgets(): Promise<void> { await native?.reloadAll(); }
export async function consumeAndroidWidgetCompletions(): Promise<string[]> { return native?.consumeCompletedTaskIds() ?? []; }
