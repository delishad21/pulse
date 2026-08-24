import type { TaskWidgetSnapshot } from "@pulse/widget-contracts";
import type { WidgetEnvironment } from "expo-widgets";

export function WidgetLayout(_props: TaskWidgetSnapshot, _environment: Pick<WidgetEnvironment, "colorScheme" | "widgetFamily">, _onComplete?: (taskId: string) => unknown) {
  "widget";
  return <></>;
}
