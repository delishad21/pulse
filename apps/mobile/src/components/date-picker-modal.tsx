import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconButton, PrimaryButton } from "@/components/ui";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { useAppTheme } from "@/providers/theme-provider";
import { localDateKey } from "@/lib/dates";

type DatePickerProps = {
  visible: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
  onClose: () => void;
  startTime?: string;
  endTime?: string;
  onTimeChange?: (startTime: string, endTime: string) => void;
};

const wheelRowHeight = 44;
const minuteChoices = Array.from({ length: 12 }, (_, index) => index * 5);
const monthChoices = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(2020, index, 1)));
const pad = (value: number) => String(value).padStart(2, "0");
const parseTime = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 9, minute: Number.isFinite(minute) ? Math.min(55, Math.max(0, Math.round(minute / 5) * 5)) : 0 };
};
const displayTime = (value: string) => {
  const { hour, minute } = parseTime(value);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hour, minute));
};

export function DatePickerModal({ visible, value, onChange, onClose, startTime, endTime, onTimeChange }: DatePickerProps) {
  const { palette } = useAppTheme();
  const { width } = useWindowDimensions();
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [draftDate, setDraftDate] = useState(value);
  const [draftStart, setDraftStart] = useState(startTime ?? "");
  const [draftEnd, setDraftEnd] = useState(endTime ?? "");
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);
  const [timeDraft, setTimeDraft] = useState("09:00");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthYear, setMonthYear] = useState(cursor.getFullYear());
  const scheduled = Boolean(onTimeChange);
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor]);
  const cell = Math.floor((Math.min(width - 36, 440) - 32) / 7);
  const shift = (amount: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const openTimePicker = (kind: "start" | "end") => {
    const existing = kind === "start" ? draftStart : draftEnd || draftStart;
    setTimeDraft(existing || (kind === "end" ? "10:00" : "09:00"));
    setTimePicker(kind);
  };
  const applyTime = (valueToApply: string) => {
    setDraftDate((current) => current ?? localDateKey());
    if (timePicker === "start") {
      setDraftStart(valueToApply);
      if (draftEnd && draftEnd <= valueToApply) setDraftEnd("");
    } else if (timePicker === "end") {
      setDraftEnd(valueToApply);
    }
    setTimePicker(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={onClose}>
        <Pressable onPress={() => undefined} style={[styles.panel, { width: Math.min(width - 36, 440), backgroundColor: palette.surfaceRaised }]}>
          <View style={styles.header}>
            <IconButton icon={ChevronLeft} label="Previous month" onPress={() => shift(-1)} />
            <Pressable onPress={() => { setMonthYear(cursor.getFullYear()); setMonthPickerOpen(true); }} style={styles.monthButton}>
              <Text style={[styles.month, { color: palette.text }]}>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor)}</Text>
              <ChevronDown size={15} color={palette.textMuted} />
            </Pressable>
            <IconButton icon={ChevronRight} label="Next month" onPress={() => shift(1)} />
          </View>
          <View style={[styles.grid, styles.calendarGrid]}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { width: cell, color: palette.textMuted }]}>{day}</Text>)}</View>
          <View style={styles.grid}>{days.map((day) => {
            const key = localDateKey(day); const active = key === (scheduled ? draftDate : value); const today = key === localDateKey(); const inMonth = day.getMonth() === cursor.getMonth();
            return <Pressable key={key} onPress={() => { if (scheduled) setDraftDate(key); else { onChange(key); onClose(); } }} style={[styles.day, { width: cell, height: cell }, active && { backgroundColor: palette.accent }]}>
              <Text style={{ color: active ? "#fff" : inMonth ? palette.text : palette.textMuted, fontFamily: today || active ? AppFontBold : AppFont, opacity: inMonth || active ? 1 : 0.45, fontWeight: today || active ? "normal" : "500" }}>{day.getDate()}</Text>
            </Pressable>;
          })}</View>
          {scheduled && <View style={[styles.timeArea, { borderTopColor: palette.border }]}>
            <Pressable onPress={() => { setDraftStart(""); setDraftEnd(""); setTimePicker(null); }} style={[styles.timeChoice, { backgroundColor: !draftStart ? palette.accentSoft : palette.surface }]}><Text style={{ color: !draftStart ? palette.accent : palette.text, fontFamily: AppFontBold, fontWeight: "normal" }}>All day</Text></Pressable>
            <Pressable onPress={() => openTimePicker("start")} style={[styles.timeChoice, { backgroundColor: draftStart ? palette.accentSoft : palette.surface }]}><Text style={{ color: draftStart ? palette.accent : palette.textMuted, fontFamily: AppFontBold, fontWeight: "normal" }}>{draftStart ? `Starts ${displayTime(draftStart)}` : "Start time"}</Text></Pressable>
            <Pressable disabled={!draftStart} onPress={() => openTimePicker("end")} style={[styles.timeChoice, { backgroundColor: draftEnd ? palette.accentSoft : palette.surface, opacity: draftStart ? 1 : 0.45 }]}><Text style={{ color: draftEnd ? palette.accent : palette.textMuted, fontFamily: AppFontBold, fontWeight: "normal" }}>{draftEnd ? `Ends ${displayTime(draftEnd)}` : "End time"}</Text></Pressable>
          </View>}
          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <Pressable onPress={() => { if (scheduled) { setDraftDate(null); setDraftStart(""); setDraftEnd(""); } else { onChange(null); onClose(); } }} style={styles.footerAction}><X size={16} color={palette.textMuted} /><Text style={{ color: palette.textMuted, fontFamily: AppFont }}>No date</Text></Pressable>
            {scheduled ? <Pressable onPress={() => { onChange(draftDate); onTimeChange?.(draftStart, draftEnd); onClose(); }} style={[styles.done, { backgroundColor: palette.accent }]}><Text style={styles.doneText}>Done</Text></Pressable> : <Pressable onPress={() => { onChange(localDateKey()); onClose(); }} style={styles.footerAction}><Text style={{ color: palette.accent, fontFamily: AppFontBold, fontWeight: "normal" }}>Today</Text></Pressable>}
          </View>
        </Pressable>
      </Pressable>
      <TimePickerPopup visible={timePicker !== null} value={timeDraft} onChange={setTimeDraft} onCancel={() => setTimePicker(null)} onDone={() => applyTime(timeDraft)} />
      <MonthPickerPopup visible={monthPickerOpen} year={monthYear} selectedMonth={cursor.getMonth()} onYearChange={setMonthYear} onSelect={(month) => { setCursor(new Date(monthYear, month, 1)); setMonthPickerOpen(false); }} onClose={() => setMonthPickerOpen(false)} />
    </Modal>
  );
}

function TimePickerPopup({ visible, value, onChange, onCancel, onDone }: { visible: boolean; value: string; onChange: (value: string) => void; onCancel: () => void; onDone: () => void }) {
  const { palette } = useAppTheme();
  const parsed = parseTime(value);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <Pressable style={[styles.popupBackdrop, { backgroundColor: palette.overlay }]} onPress={onCancel}>
      <Pressable onPress={() => undefined} style={[styles.timePopup, { backgroundColor: palette.surfaceRaised }]}>
        <View style={styles.popupHeader}><Text style={[styles.popupTitle, { color: palette.text }]}>Select time</Text><IconButton icon={X} label="Close time picker" onPress={onCancel} /></View>
        <View style={styles.wheels}>
          <WheelColumn label="Hour" values={hours} selected={parsed.hour} onSelect={(hour) => onChange(`${pad(hour)}:${pad(parsed.minute)}`)} />
          <Text style={[styles.colon, { color: palette.textMuted }]}>:</Text>
          <WheelColumn label="Minute" values={minuteChoices} selected={parsed.minute} onSelect={(minute) => onChange(`${pad(parsed.hour)}:${pad(minute)}`)} />
        </View>
        <View style={[styles.popupFooter, { borderTopColor: palette.border }]}><Pressable onPress={onCancel} style={styles.footerAction}><Text style={{ color: palette.textMuted, fontFamily: AppFontBold, fontWeight: "normal" }}>Cancel</Text></Pressable><PrimaryButton onPress={onDone} style={styles.done}>Done</PrimaryButton></View>
      </Pressable>
    </Pressable>
  </Modal>;
}

function WheelColumn({ label, values, selected, onSelect }: { label: string; values: number[]; selected: number; onSelect: (value: number) => void }) {
  const { palette } = useAppTheme();
  const ref = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, values.indexOf(selected));
  const scrollToSelected = useCallback(() => { ref.current?.scrollTo({ y: (selectedIndex + 1) * wheelRowHeight, animated: false }); }, [selectedIndex]);
  useEffect(() => { if (ref.current) requestAnimationFrame(scrollToSelected); }, [scrollToSelected]);
  const updateFromOffset = (offset: number) => {
    const index = Math.min(values.length - 1, Math.max(0, Math.round(offset / wheelRowHeight) - 1));
    onSelect(values[index]);
  };
  return <View style={styles.wheelColumn}><Text style={[styles.wheelLabel, { color: palette.textMuted }]}>{label}</Text><View style={[styles.wheelViewport, { borderColor: palette.border }]}><ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={wheelRowHeight} decelerationRate="fast" nestedScrollEnabled contentContainerStyle={{ paddingVertical: wheelRowHeight * 2 }} onMomentumScrollEnd={(event) => updateFromOffset(event.nativeEvent.contentOffset.y)} onScrollEndDrag={(event) => updateFromOffset(event.nativeEvent.contentOffset.y)}>{values.map((item) => <View key={item} style={styles.wheelRow}><Text style={[styles.wheelValue, { color: item === selected ? palette.text : palette.textMuted, fontFamily: item === selected ? AppFontBold : AppFont, fontWeight: item === selected ? "normal" : "500" }]}>{pad(item)}</Text></View>)}</ScrollView><View pointerEvents="none" style={[styles.wheelSelection, { borderColor: palette.accent, backgroundColor: palette.accentSoft + "55" }]} /></View></View>;
}

function MonthPickerPopup({ visible, year, selectedMonth, onYearChange, onSelect, onClose }: { visible: boolean; year: number; selectedMonth: number; onYearChange: (year: number) => void; onSelect: (month: number) => void; onClose: () => void }) {
  const { palette } = useAppTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={[styles.popupBackdrop, { backgroundColor: palette.overlay }]} onPress={onClose}>
      <Pressable onPress={() => undefined} style={[styles.monthPopup, { backgroundColor: palette.surfaceRaised }]}>
        <View style={styles.popupHeader}><Text style={[styles.popupTitle, { color: palette.text }]}>Jump to month</Text><IconButton icon={X} label="Close month picker" onPress={onClose} /></View>
        <View style={styles.yearHeader}><IconButton icon={ChevronLeft} label="Previous year" onPress={() => onYearChange(year - 1)} /><Text style={[styles.year, { color: palette.text }]}>{year}</Text><IconButton icon={ChevronRight} label="Next year" onPress={() => onYearChange(year + 1)} /></View>
        <View style={styles.monthGrid}>{monthChoices.map((month, index) => <Pressable key={`${year}-${month}`} onPress={() => onSelect(index)} style={[styles.monthCell, { backgroundColor: index === selectedMonth ? palette.accent : palette.surface }]}><Text style={{ color: index === selectedMonth ? "#fff" : palette.text, fontFamily: AppFontBold, fontWeight: "normal" }}>{month}</Text></Pressable>)}</View>
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 }, panel: { borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 },
  header: { height: 52, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, monthButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: 10 }, month: { fontFamily: AppFontBold, fontSize: 17, fontWeight: "normal" }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }, calendarGrid: { marginBottom: 3 }, weekday: { fontFamily: AppFontBold, textAlign: "center", fontSize: 12, fontWeight: "normal", marginBottom: 6 }, day: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" }, footerAction: { height: 36, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 }, timeArea: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 7 }, timeChoice: { minHeight: 38, borderRadius: 9, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, done: { minWidth: 84, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center" }, doneText: { color: "#fff", fontFamily: AppFontBold, fontWeight: "normal" },
  popupBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 }, timePopup: { width: "100%", maxWidth: 340, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, elevation: 12 }, popupHeader: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, popupTitle: { fontFamily: AppFontBold, fontSize: 17, fontWeight: "normal" }, wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 }, colon: { fontFamily: AppFontBold, fontSize: 24, fontWeight: "normal", paddingTop: 18 }, wheelColumn: { width: 96, alignItems: "center" }, wheelLabel: { fontFamily: AppFontBold, fontSize: 11, fontWeight: "normal", marginBottom: 5 }, wheelViewport: { width: "100%", height: wheelRowHeight * 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" }, wheelRow: { height: wheelRowHeight, alignItems: "center", justifyContent: "center" }, wheelValue: { fontFamily: AppFont, fontSize: 20 }, wheelSelection: { position: "absolute", left: 5, right: 5, top: wheelRowHeight, height: wheelRowHeight, borderWidth: 1, borderRadius: 9 }, popupFooter: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthPopup: { width: "100%", maxWidth: 360, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, elevation: 12 }, yearHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, year: { fontFamily: AppFontBold, fontSize: 20, fontWeight: "normal" }, monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, monthCell: { width: "30.5%", minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
