import { Button, HStack, Link, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { buttonStyle, containerBackground, font, foregroundStyle, frame, lineLimit, padding } from "@expo/ui/swift-ui/modifiers";
import type { TaskWidgetSnapshot } from "@pulse/widget-contracts";
import type { WidgetEnvironment } from "expo-widgets";

export function WidgetLayout(props: TaskWidgetSnapshot, environment: Pick<WidgetEnvironment, "colorScheme" | "widgetFamily">, onComplete?: (taskId: string) => unknown) {
  "widget";
  // The Swift widget renderer serializes this function and evaluates it in an
  // isolated scope. Keep values used by the serialized body local to the
  // function; module-level constants are not available at render time.
  const priorityColor = { none: "#96969d", low: "#4a8fe7", medium: "#d7a528", high: "#e2783e", urgent: "#dc4f49" } as const;
  const configuration = props.configuration ?? { theme: "system", backgroundOpacity: 1, density: "comfortable", arrangement: "list" };
  const tasks = props.tasks ?? [];
  const dark = configuration.theme === "dark" || (configuration.theme === "system" && environment.colorScheme === "dark");
  const foreground = dark ? "#f5f5f6" : "#202124";
  const muted = dark ? "#a1a1a7" : "#77787d";
  const alpha = Math.round(configuration.backgroundOpacity * 255).toString(16).padStart(2, "0");
  const background = `${dark ? "#202022" : "#ffffff"}${alpha}`;
  const max = environment.widgetFamily === "systemSmall" ? 3 : environment.widgetFamily === "systemMedium" ? 4 : environment.widgetFamily === "systemExtraLarge" ? 12 : 8;
  const compact = configuration.density === "compact";
  const detailed = configuration.density === "detailed";
  const grouped = configuration.arrangement === "grouped" && (props.view === "inbox" || props.view === "upcoming");
  return (
    <VStack alignment="leading" spacing={compact ? 4 : 7} modifiers={[padding({ all: compact ? 11 : 14 }), frame({ maxWidth: 900, maxHeight: 900, alignment: "topLeading" }), containerBackground(background, "widget")]}>
      <HStack>
        <Link destination={`pulse://widget/view/${props.view}`}>
          <HStack>
            <Text modifiers={[font({ size: 16, weight: "bold" }), foregroundStyle(foreground)]}>{props.title}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(props.accentColor)]}>{props.openCount}</Text>
          </HStack>
        </Link>
        <Spacer />
        <Link destination="pulse://widget/add">
          <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(foreground)]}>＋</Text>
        </Link>
      </HStack>
      {tasks.slice(0, max).map((task, index) => {
        const showHeading = grouped && task.dateLabel !== tasks[index - 1]?.dateLabel;
        const meta = [grouped ? null : task.dueLabel, task.projectName, detailed ? task.location : null, detailed && task.tagNames.length ? task.tagNames.join(", ") : null].filter(Boolean).join(" · ");
        return <VStack key={task.id} alignment="leading" spacing={compact ? 2 : 4}>
          {showHeading && <Text modifiers={[font({ size: 10, weight: "semibold" }), foregroundStyle(task.isOverdue ? "#dc4f49" : muted), lineLimit(1)]}>{task.dateLabel ?? "No date"}</Text>}
          <HStack spacing={7}>
            <Button target={`complete:${task.id}`} onPress={() => (onComplete ? onComplete(task.id) : { ...props, openCount: Math.max(0, props.openCount - 1), totalCount: Math.max(0, props.totalCount - 1), tasks: tasks.filter((item) => item.id !== task.id) }) as never} modifiers={[buttonStyle("plain"), frame({ width: 20, height: 20, alignment: "center" })]}>
              <Text modifiers={[font({ size: compact ? 11 : 12, weight: "bold" }), foregroundStyle(priorityColor[task.priority])]}>○</Text>
            </Button>
            <Link destination={`pulse://widget/task/${task.id}`}>
              <VStack alignment="leading" spacing={1}>
                <Text modifiers={[font({ size: compact ? 12 : 13, weight: "medium" }), foregroundStyle(foreground), lineLimit(detailed ? 2 : 1)]}>{task.title}</Text>
                {meta && <Text modifiers={[font({ size: 10 }), foregroundStyle(task.isOverdue ? "#dc4f49" : muted), lineLimit(1)]}>{meta}</Text>}
              </VStack>
            </Link>
            <Spacer />
          </HStack>
        </VStack>;
      })}
      {!tasks.length && <VStack alignment="leading" spacing={3}><Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(foreground)]}>All clear</Text><Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>Open Pulse to plan what is next.</Text></VStack>}
      <Spacer />
      {props.totalCount > max && <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>+{props.totalCount - max} more in Pulse</Text>}
    </VStack>
  );
}
