import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import DatePickerField from '../components/DatePickerField';

const PALETTE = {
  bg: '#F8F9FB',
  white: '#FFFFFF',
  accent: '#3B6FEB',
  accentLight: '#EEF3FD',
  border: '#E5E8EE',
  text: '#1A1D23',
  muted: '#6B7280',
  placeholder: '#9CA3AF',
};

// Indices 0–5 are preset fixed labels; 6–9 are user-editable "Other" rows
const FIXED_RANGE_COUNT = 6;
// Indices 0–8 are preset fixed labels; 9–13 are user-editable "Other" rows
const FIXED_SINGLE_COUNT = 9;

type TimelineType = 'calendar' | 'school';

interface ExcludedRange {
  label: string;
  startDate: string;
  endDate: string;
}

interface ExcludedSingleDate {
  label: string;
  date: string;
}

interface Props {
  onBack: () => void;
}

const INITIAL_EXCLUDED_RANGES: ExcludedRange[] = [
  { label: 'Summer Break (Previous)', startDate: '', endDate: '' },
  { label: 'Fall Break',              startDate: '', endDate: '' },
  { label: 'Thanksgiving Break',      startDate: '', endDate: '' },
  { label: 'Winter Break',            startDate: '', endDate: '' },
  { label: 'Spring Break',            startDate: '', endDate: '' },
  { label: 'Summer Break (Next)',     startDate: '', endDate: '' },
  { label: 'Other Range 1',           startDate: '', endDate: '' },
  { label: 'Other Range 2',           startDate: '', endDate: '' },
  { label: 'Other Range 3',           startDate: '', endDate: '' },
  { label: 'Other Range 4',           startDate: '', endDate: '' },
];

const INITIAL_EXCLUDED_SINGLES: ExcludedSingleDate[] = [
  { label: 'Independence Day',  date: '' },
  { label: 'Labor Day',         date: '' },
  { label: 'Veterans Day',      date: '' },
  { label: 'Dr. MLK Day',       date: '' },
  { label: 'Lincoln Day',       date: '' },
  { label: 'Washington Day',    date: '' },
  { label: 'Cesar Chavez Day',  date: '' },
  { label: 'Memorial Day',      date: '' },
  { label: 'Juneteenth',        date: '' },
  { label: 'Other Day 1',       date: '' },
  { label: 'Other Day 2',       date: '' },
  { label: 'Other Day 3',       date: '' },
  { label: 'Other Day 4',       date: '' },
  { label: 'Other Day 5',       date: '' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function calculateDueDate(
  consentDate: string,
  timelineDays: number,
  timelineType: TimelineType,
  excludedRanges: ExcludedRange[],
  excludedSingleDates: ExcludedSingleDate[],
): string {
  if (!consentDate || timelineDays <= 0) return '';
  const start = parseDate(consentDate);
  if (!start) return '';

  // Build set of explicitly excluded dates
  const excludedSet = new Set<string>();
  for (const range of excludedRanges) {
    if (!range.startDate || !range.endDate) continue;
    const s = parseDate(range.startDate);
    const e = parseDate(range.endDate);
    if (!s || !e || s > e) continue;
    const cur = new Date(s);
    while (cur <= e) { excludedSet.add(formatDate(cur)); cur.setDate(cur.getDate() + 1); }
  }
  for (const sd of excludedSingleDates) {
    if (sd.date) excludedSet.add(sd.date);
  }

  const current = new Date(start);
  let counted = 0;
  while (counted < timelineDays) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    // School Days mode: skip weekends (shown in log as "Weekend")
    if (timelineType === 'school' && (dow === 0 || dow === 6)) continue;
    // Skip explicitly excluded dates
    if (excludedSet.has(formatDate(current))) continue;
    counted++;
  }
  return formatDate(current);
}

// Log shows ALL skipped dates: explicitly excluded dates + weekends in School Days mode
function buildExcludedLog(
  consentDate: string,
  timelineDays: number,
  timelineType: TimelineType,
  excludedRanges: ExcludedRange[],
  excludedSingleDates: ExcludedSingleDate[],
): { date: string; label: string }[] {
  const log: { date: string; label: string }[] = [];
  const seen = new Set<string>();

  // Explicitly excluded dates from ranges
  for (const range of excludedRanges) {
    if (!range.startDate || !range.endDate) continue;
    const s = parseDate(range.startDate);
    const e = parseDate(range.endDate);
    if (!s || !e || s > e) continue;
    const cur = new Date(s);
    while (cur <= e) {
      const key = formatDate(cur);
      if (!seen.has(key)) { seen.add(key); log.push({ date: key, label: range.label }); }
      cur.setDate(cur.getDate() + 1);
    }
  }
  // Explicitly excluded single dates
  for (const sd of excludedSingleDates) {
    if (sd.date && !seen.has(sd.date)) { seen.add(sd.date); log.push({ date: sd.date, label: sd.label }); }
  }
  // In School Days mode, also include every weekend within the timeline range
  if (timelineType === 'school' && consentDate && timelineDays > 0) {
    const due = calculateDueDate(consentDate, timelineDays, timelineType, excludedRanges, excludedSingleDates);
    if (due) {
      const start = parseDate(consentDate);
      const end = parseDate(due);
      if (start && end) {
        const cur = new Date(start);
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) {
          const dow = cur.getDay();
          if (dow === 0 || dow === 6) {
            const key = formatDate(cur);
            if (!seen.has(key)) { seen.add(key); log.push({ date: key, label: 'Weekend' }); }
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
  }
  return log.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DueDateCalculatorScreen({ onBack }: Props) {
  const [consentDate, setConsentDate] = useState('');
  const [timelineDays, setTimelineDays] = useState('');
  const [timelineType, setTimelineType] = useState<TimelineType>('school');
  const [excludedRanges, setExcludedRanges] = useState<ExcludedRange[]>(INITIAL_EXCLUDED_RANGES);
  const [excludedSingleDates, setExcludedSingleDates] = useState<ExcludedSingleDate[]>(INITIAL_EXCLUDED_SINGLES);
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents debounced save from firing before/during initial load
  const loadCompleteRef = useRef(false);

  const dueDate = useMemo(
    () => calculateDueDate(consentDate, parseInt(timelineDays) || 0, timelineType, excludedRanges, excludedSingleDates),
    [consentDate, timelineDays, timelineType, excludedRanges, excludedSingleDates],
  );

  const excludedLog = useMemo(
    () => buildExcludedLog(consentDate, parseInt(timelineDays) || 0, timelineType, excludedRanges, excludedSingleDates),
    [consentDate, timelineDays, timelineType, excludedRanges, excludedSingleDates],
  );

  // Load saved data on mount
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { loadCompleteRef.current = true; return; }

    const docRef = doc(db, 'users', uid, 'calculators', 'dueDateCalculator');
    getDoc(docRef)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.consentDate)  setConsentDate(data.consentDate);
        if (data.timelineDays) setTimelineDays(String(data.timelineDays));
        if (data.timelineType) setTimelineType(data.timelineType);
        if (data.excludedRanges) {
          const loaded: ExcludedRange[] = data.excludedRanges;
          setExcludedRanges(INITIAL_EXCLUDED_RANGES.map((init, i) => ({
            label:     loaded[i]?.label     ?? init.label,
            startDate: loaded[i]?.startDate ?? '',
            endDate:   loaded[i]?.endDate   ?? '',
          })));
        }
        if (data.excludedSingleDates) {
          const loaded: ExcludedSingleDate[] = data.excludedSingleDates;
          setExcludedSingleDates(INITIAL_EXCLUDED_SINGLES.map((init, i) => ({
            label: loaded[i]?.label ?? init.label,
            date:  loaded[i]?.date  ?? '',
          })));
        }
      })
      .catch(() => { /* silent fail — user starts with empty form */ })
      .finally(() => {
        // Use setTimeout so the ref flips after React processes the state updates
        // above, preventing an immediate save of the just-loaded data.
        setTimeout(() => { loadCompleteRef.current = true; }, 50);
      });
  }, []);

  // Debounced auto-save (500 ms) on any field change
  useEffect(() => {
    if (!loadCompleteRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      setSavedStatus('saving');
      try {
        await setDoc(
          doc(db, 'users', uid, 'calculators', 'dueDateCalculator'),
          {
            consentDate,
            timelineDays: parseInt(timelineDays) || 0,
            timelineType,
            excludedRanges,
            excludedSingleDates,
            calculatedDueDate: dueDate,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setSavedStatus('saved');
        if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
        savedStatusTimerRef.current = setTimeout(() => setSavedStatus('idle'), 2000);
      } catch {
        setSavedStatus('idle');
      }
    }, 500);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [consentDate, timelineDays, timelineType, excludedRanges, excludedSingleDates]);

  const updateRange = (index: number, field: keyof ExcludedRange, value: string) =>
    setExcludedRanges(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const updateSingle = (index: number, field: keyof ExcludedSingleDate, value: string) =>
    setExcludedSingleDates(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Due Date Calculator</Text>
        <Text style={styles.savedIndicator}>
          {savedStatus === 'saving' ? 'Saving...' : savedStatus === 'saved' ? 'Saved' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Due Date Card ─────────────────────────────────────────────── */}
        <View style={styles.dueDateCard}>
          <Text style={styles.dueDateCardLabel}>CALCULATED DUE DATE</Text>
          <Text style={styles.dueDateCardValue}>{dueDate || '—'}</Text>
        </View>

        {/* ── Calculator Inputs ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>CALCULATOR INPUTS</Text>
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Consent / Request Date</Text>
            <View style={styles.inputDateWrap}>
              <DatePickerField value={consentDate} onChange={setConsentDate} />
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Timeline Length</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. 60"
              placeholderTextColor={PALETTE.placeholder}
              value={timelineDays}
              onChangeText={setTimelineDays}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <View style={[styles.inputRow, styles.inputRowLast]}>
            <Text style={styles.inputLabel}>
              {timelineDays ? `Timeline Type (${timelineDays} days)` : 'Timeline Type'}
            </Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segBtn, timelineType === 'calendar' && styles.segBtnActive]}
                onPress={() => setTimelineType('calendar')}
              >
                <Text style={[styles.segBtnText, timelineType === 'calendar' && styles.segBtnTextActive]}>
                  Calendar Days
                </Text>
                <Text style={[styles.segBtnSubText, timelineType === 'calendar' && styles.segBtnSubTextActive]}>
                  counts weekends
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, timelineType === 'school' && styles.segBtnActive]}
                onPress={() => setTimelineType('school')}
              >
                <Text style={[styles.segBtnText, timelineType === 'school' && styles.segBtnTextActive]}>
                  School Days
                </Text>
                <Text style={[styles.segBtnSubText, timelineType === 'school' && styles.segBtnSubTextActive]}>
                  skips weekends
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Excluded Date Ranges ──────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>EXCLUDED DATE RANGES</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Break / Event</Text>
            <Text style={[styles.tableHeaderCell, { flex: 4, textAlign: 'center' }]}>Start Date</Text>
            <Text style={[styles.tableHeaderCell, { flex: 4, textAlign: 'center' }]}>End Date</Text>
          </View>
          {excludedRanges.map((range, i) => (
            <View key={i} style={[styles.tableRow, i < excludedRanges.length - 1 && styles.tableRowDivider]}>
              {i >= FIXED_RANGE_COUNT ? (
                <TextInput
                  style={[styles.tableCellEditable, { flex: 5 }]}
                  value={range.label}
                  onChangeText={v => updateRange(i, 'label', v)}
                  placeholder="Label"
                  placeholderTextColor={PALETTE.placeholder}
                />
              ) : (
                <Text style={[styles.tableCellLabel, { flex: 5 }]}>{range.label}</Text>
              )}
              <View style={{ flex: 4 }}>
                <DatePickerField value={range.startDate} onChange={v => updateRange(i, 'startDate', v)} />
              </View>
              <View style={{ flex: 4 }}>
                <DatePickerField value={range.endDate} onChange={v => updateRange(i, 'endDate', v)} />
              </View>
            </View>
          ))}
        </View>

        {/* ── Excluded Single Dates ─────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>EXCLUDED SINGLE DATES</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 5 }]}>Holiday / Event</Text>
            <Text style={[styles.tableHeaderCell, { flex: 4, textAlign: 'center' }]}>Date</Text>
          </View>
          {excludedSingleDates.map((sd, i) => (
            <View key={i} style={[styles.tableRow, i < excludedSingleDates.length - 1 && styles.tableRowDivider]}>
              {i >= FIXED_SINGLE_COUNT ? (
                <TextInput
                  style={[styles.tableCellEditable, { flex: 5 }]}
                  value={sd.label}
                  onChangeText={v => updateSingle(i, 'label', v)}
                  placeholder="Label"
                  placeholderTextColor={PALETTE.placeholder}
                />
              ) : (
                <Text style={[styles.tableCellLabel, { flex: 5 }]}>{sd.label}</Text>
              )}
              <View style={{ flex: 4 }}>
                <DatePickerField value={sd.date} onChange={v => updateSingle(i, 'date', v)} />
              </View>
            </View>
          ))}
        </View>

        {/* ── Excluded Date Log ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>EXCLUDED DATE LOG</Text>
        <View style={styles.logCard}>
          {excludedLog.length === 0 ? (
            <Text style={styles.logEmpty}>No excluded dates entered.</Text>
          ) : (
            excludedLog.map((item, i) => (
              <View key={i} style={[styles.logRow, i < excludedLog.length - 1 && styles.logRowDivider]}>
                <Text style={styles.logIndex}>{i + 1}.</Text>
                <Text style={styles.logDate}>{item.date}</Text>
                <Text style={styles.logLabel}>{item.label}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  backBtn: {
    minWidth: 64,
  },
  backBtnText: {
    fontSize: 14,
    color: PALETTE.accent,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  savedIndicator: {
    minWidth: 64,
    fontSize: 12,
    color: PALETTE.muted,
    textAlign: 'right',
  },
  scroll: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  // Due Date Card
  dueDateCard: {
    marginHorizontal: 16,
    backgroundColor: PALETTE.accent,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dueDateCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  dueDateCardValue: {
    fontSize: 36,
    fontWeight: '700',
    color: PALETTE.white,
    letterSpacing: -0.5,
  },
  // Section header (blue, uppercase)
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.accent,
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  // Input Card (core inputs)
  inputCard: {
    marginHorizontal: 16,
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    minHeight: 52,
    gap: 12,
  },
  inputRowLast: {
    borderBottomWidth: 0,
  },
  inputLabel: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.text,
    fontWeight: '500',
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.text,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: PALETTE.bg,
  },
  inputDateWrap: {
    flex: 1,
  },
  // Segmented toggle
  segmented: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: PALETTE.bg,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: PALETTE.accent,
  },
  segBtnText: {
    fontSize: 11,
    color: PALETTE.muted,
    fontWeight: '500',
  },
  segBtnTextActive: {
    color: PALETTE.white,
    fontWeight: '600',
  },
  segBtnSubText: {
    fontSize: 9,
    color: PALETTE.placeholder,
    marginTop: 1,
    textAlign: 'center',
  },
  segBtnSubTextActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  // Table
  table: {
    marginHorizontal: 16,
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PALETTE.bg,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '600',
    color: PALETTE.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    gap: 6,
  },
  tableRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  tableCellLabel: {
    fontSize: 13,
    color: PALETTE.text,
    fontWeight: '500',
  },
  // Editable label cell — subtle underline to signal editability
  tableCellEditable: {
    fontSize: 13,
    color: PALETTE.accent,
    fontWeight: '500',
    padding: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    paddingVertical: 2,
  },
  // Log
  logCard: {
    marginHorizontal: 16,
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
  },
  logEmpty: {
    fontSize: 13,
    color: PALETTE.placeholder,
    padding: 20,
    textAlign: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  logRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  logIndex: {
    fontSize: 12,
    color: PALETTE.placeholder,
    width: 22,
    textAlign: 'right',
  },
  logDate: {
    fontSize: 13,
    color: PALETTE.text,
    fontWeight: '600',
    width: 96,
  },
  logLabel: {
    flex: 1,
    fontSize: 13,
    color: PALETTE.muted,
  },
});
