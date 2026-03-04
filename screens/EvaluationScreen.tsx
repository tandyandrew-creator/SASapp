import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
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

type EvalType = 'Initial' | 'Triennial' | 'Other';
export type EvalScoreType = 'standard' | 'scaled' | 'tscore' | 'zscore' | 'percentile';

export interface EvalMeasure {
  id: string;
  name: string;
  score: number;
  scoreType: EvalScoreType;
}

const EVAL_TYPES: EvalType[] = ['Initial', 'Triennial', 'Other'];

const SCORE_TYPES: { value: EvalScoreType; label: string }[] = [
  { value: 'standard', label: 'SS' },
  { value: 'scaled', label: 'Scaled' },
  { value: 'tscore', label: 'T' },
  { value: 'zscore', label: 'Z' },
  { value: 'percentile', label: 'Pct' },
];

interface Props {
  studentId: string;
  evalId: string;
  studentName: string;
  onBack: () => void;
  onViewGraph: (measures: EvalMeasure[], studentName: string, evalType: string, evalDate: string) => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EvaluationScreen({ studentId, evalId, studentName, onBack, onViewGraph }: Props) {
  const [loading, setLoading] = useState(true);
  const [evalType, setEvalType] = useState<EvalType>('Initial');
  const [customEvalType, setCustomEvalType] = useState('');
  const [evalDate, setEvalDate] = useState(todayStr());
  const [measures, setMeasures] = useState<EvalMeasure[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newScoreType, setNewScoreType] = useState<EvalScoreType>('standard');
  const [addingSaving, setAddingSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'students', studentId, 'evaluations', evalId),
      (snap) => {
        if (!snap.exists()) { setLoading(false); return; }
        const data = snap.data();
        if (!loadedRef.current) {
          loadedRef.current = true;
          setEvalType((data.evalType as EvalType) || 'Initial');
          setCustomEvalType(data.customEvalType || '');
          setEvalDate(data.evalDate || todayStr());
          setMeasures((data.measures as EvalMeasure[]) || []);
        } else {
          // Only sync measures from server to pick up remote changes
          setMeasures((data.measures as EvalMeasure[]) || []);
        }
        setLoading(false);
      },
      () => { Alert.alert('Error', 'Could not load evaluation.'); setLoading(false); },
    );
    return unsub;
  }, [studentId, evalId]);

  const scheduleFieldSave = (type: EvalType, custom: string, date: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'students', studentId, 'evaluations', evalId), {
          evalType: type,
          customEvalType: custom,
          evalDate: date,
        });
      } catch { /* silent */ }
    }, 500);
  };

  const handleEvalTypeChange = (t: EvalType) => { setEvalType(t); scheduleFieldSave(t, customEvalType, evalDate); };
  const handleCustomTypeChange = (v: string) => { setCustomEvalType(v); scheduleFieldSave(evalType, v, evalDate); };
  const handleDateChange = (v: string) => { setEvalDate(v); scheduleFieldSave(evalType, customEvalType, v); };

  const handleDeleteMeasure = async (measureId: string) => {
    const next = measures.filter(m => m.id !== measureId);
    setMeasures(next);
    try {
      await updateDoc(doc(db, 'students', studentId, 'evaluations', evalId), { measures: next });
    } catch {
      Alert.alert('Error', 'Could not delete measure.');
    }
  };

  const handleAddMeasure = async () => {
    const scoreNum = parseFloat(newScore);
    if (!newName.trim()) { Alert.alert('Required', 'Please enter a subtest name.'); return; }
    if (isNaN(scoreNum)) { Alert.alert('Required', 'Please enter a valid score.'); return; }
    setAddingSaving(true);
    const next: EvalMeasure[] = [
      ...measures,
      { id: `m${Date.now()}`, name: newName.trim(), score: scoreNum, scoreType: newScoreType },
    ];
    try {
      await updateDoc(doc(db, 'students', studentId, 'evaluations', evalId), { measures: next });
      setMeasures(next);
      setNewName('');
      setNewScore('');
      setNewScoreType('standard');
      setShowAddForm(false);
    } catch {
      Alert.alert('Error', 'Could not add measure.');
    } finally {
      setAddingSaving(false);
    }
  };

  const getEvalLabel = () => evalType === 'Other' && customEvalType ? customEvalType : evalType;

  const handleViewGraph = () => {
    if (measures.length === 0) {
      Alert.alert('No Measures', 'Add at least one measure before viewing the graph.');
      return;
    }
    onViewGraph(measures, studentName, getEvalLabel(), evalDate);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={PALETTE.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{studentName}</Text>
          <Text style={styles.headerSub}>{getEvalLabel()} · {evalDate}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionLabel}>Evaluation Type</Text>
          <View style={styles.typeRow}>
            {EVAL_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, evalType === t && styles.typeBtnActive]}
                onPress={() => handleEvalTypeChange(t)}
              >
                <Text style={[styles.typeBtnText, evalType === t && styles.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {evalType === 'Other' && (
            <TextInput
              style={styles.input}
              placeholder="Custom evaluation type"
              placeholderTextColor={PALETTE.placeholder}
              value={customEvalType}
              onChangeText={handleCustomTypeChange}
            />
          )}

          <Text style={styles.sectionLabel}>Evaluation Date</Text>
          <View style={styles.dateWrap}>
            <DatePickerField value={evalDate} onChange={handleDateChange} />
          </View>

          <View style={styles.measuresHeader}>
            <Text style={styles.sectionLabel}>Measures</Text>
            {!showAddForm && (
              <TouchableOpacity onPress={() => setShowAddForm(true)} style={styles.addMeasureBtn}>
                <Text style={styles.addMeasureBtnText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {measures.map(m => (
            <View key={m.id} style={styles.measureRow}>
              <View style={styles.measureInfo}>
                <Text style={styles.measureName}>{m.name}</Text>
                <Text style={styles.measureScore}>
                  {m.score} · {SCORE_TYPES.find(s => s.value === m.scoreType)?.label ?? m.scoreType}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteMeasure(m.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIcon}>×</Text>
              </TouchableOpacity>
            </View>
          ))}

          {measures.length === 0 && !showAddForm && (
            <Text style={styles.emptyMeasures}>No measures yet. Tap "+ Add" to add one.</Text>
          )}

          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>New Measure</Text>
              <TextInput
                style={styles.input}
                placeholder="Subtest name (e.g. WISC-V: Vocabulary)"
                placeholderTextColor={PALETTE.placeholder}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder="Score"
                placeholderTextColor={PALETTE.placeholder}
                value={newScore}
                onChangeText={setNewScore}
                keyboardType="numeric"
              />
              <Text style={styles.scoreTypeLabel}>Score Type</Text>
              <View style={styles.scoreTypeRow}>
                {SCORE_TYPES.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.scoreTypeBtn, newScoreType === s.value && styles.scoreTypeBtnActive]}
                    onPress={() => setNewScoreType(s.value)}
                  >
                    <Text style={[styles.scoreTypeBtnText, newScoreType === s.value && styles.scoreTypeBtnTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addFormActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowAddForm(false); setNewName(''); setNewScore(''); setNewScoreType('standard'); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, addingSaving && { opacity: 0.7 }]}
                  onPress={handleAddMeasure}
                  disabled={addingSaving}
                >
                  {addingSaving
                    ? <ActivityIndicator color={PALETTE.white} />
                    : <Text style={styles.saveBtnText}>Save Measure</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={styles.fab} onPress={handleViewGraph}>
        <Text style={styles.fabText}>View Graph →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  backBtn: { width: 70 },
  backBtnText: { fontSize: 15, color: PALETTE.accent, fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: PALETTE.text, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: PALETTE.muted, marginTop: 1 },
  headerRight: { width: 70 },
  content: { padding: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: 'center',
    backgroundColor: PALETTE.white,
  },
  typeBtnActive: { backgroundColor: PALETTE.accent, borderColor: PALETTE.accent },
  typeBtnText: { fontSize: 14, fontWeight: '500', color: PALETTE.muted },
  typeBtnTextActive: { color: PALETTE.white, fontWeight: '600' },
  input: {
    backgroundColor: PALETTE.white,
    color: PALETTE.text,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  dateWrap: { marginBottom: 20 },
  measuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addMeasureBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: PALETTE.accent,
    backgroundColor: PALETTE.accentLight,
  },
  addMeasureBtnText: { fontSize: 13, color: PALETTE.accent, fontWeight: '600' },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
    marginBottom: 8,
  },
  measureInfo: { flex: 1 },
  measureName: { fontSize: 14, fontWeight: '600', color: PALETTE.text },
  measureScore: { fontSize: 13, color: PALETTE.muted, marginTop: 2 },
  deleteIcon: { fontSize: 22, color: PALETTE.placeholder, lineHeight: 24, paddingLeft: 8 },
  emptyMeasures: { fontSize: 14, color: PALETTE.placeholder, textAlign: 'center', paddingVertical: 20 },
  addForm: {
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  addFormTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.text, marginBottom: 14 },
  scoreTypeLabel: { fontSize: 12, fontWeight: '600', color: PALETTE.muted, marginBottom: 8 },
  scoreTypeRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  scoreTypeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.bg,
  },
  scoreTypeBtnActive: { backgroundColor: PALETTE.accent, borderColor: PALETTE.accent },
  scoreTypeBtnText: { fontSize: 13, fontWeight: '500', color: PALETTE.muted },
  scoreTypeBtnTextActive: { color: PALETTE.white, fontWeight: '600' },
  addFormActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: PALETTE.muted, fontWeight: '500' },
  saveBtn: {
    flex: 2,
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: PALETTE.white, fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    left: 20,
    backgroundColor: PALETTE.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PALETTE.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: PALETTE.white, fontSize: 16, fontWeight: '600' },
});
