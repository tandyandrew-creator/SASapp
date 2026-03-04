import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
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

export interface StudentRef {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string;
}

type EvalType = 'Initial' | 'Triennial' | 'Other';

interface Evaluation {
  id: string;
  evalType: string;
  customEvalType: string;
  evalDate: string;
  measures: Array<{ id: string; name: string; score: number }>;
  notes: string;
  isArchived: boolean;
  createdAt: Timestamp | null;
}

interface Props {
  student: StudentRef;
  onBack: () => void;
  onViewEval: (evalId: string, evalType: string, customEvalType: string, evalDate: string) => void;
}

const EVAL_TYPES: EvalType[] = ['Initial', 'Triennial', 'Other'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export default function StudentDetailScreen({ student, onBack, onViewEval }: Props) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvalType, setNewEvalType] = useState<EvalType>('Initial');
  const [newCustomType, setNewCustomType] = useState('');
  const [newEvalDate, setNewEvalDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'students', student.id, 'evaluations'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Evaluation))
          .sort((a, b) => {
            if (a.evalDate > b.evalDate) return -1;
            if (a.evalDate < b.evalDate) return 1;
            return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
          });
        setEvaluations(list);
        setLoading(false);
      },
      () => {
        Alert.alert('Error', 'Could not load evaluations.');
        setLoading(false);
      },
    );
    return unsub;
  }, [student.id]);

  const filtered = showArchived ? evaluations : evaluations.filter(e => !e.isArchived);

  const handleAddEval = async () => {
    if (newEvalType === 'Other' && !newCustomType.trim()) {
      Alert.alert('Required', 'Please enter a custom evaluation type.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'students', student.id, 'evaluations'), {
        evalType: newEvalType,
        customEvalType: newCustomType.trim(),
        evalDate: newEvalDate,
        measures: [],
        notes: '',
        isArchived: false,
        createdAt: serverTimestamp(),
      });
      resetModal();
    } catch {
      Alert.alert('Error', 'Could not add evaluation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (evalItem: Evaluation) => {
    const next = !evalItem.isArchived;
    try {
      await updateDoc(doc(db, 'students', student.id, 'evaluations', evalItem.id), {
        isArchived: next,
      });
    } catch {
      Alert.alert('Error', `Could not ${next ? 'archive' : 'unarchive'} evaluation.`);
    }
  };

  const resetModal = () => {
    setModalVisible(false);
    setNewEvalType('Initial');
    setNewCustomType('');
    setNewEvalDate(todayStr());
  };

  const getEvalLabel = (e: Evaluation) =>
    e.evalType === 'Other' && e.customEvalType ? e.customEvalType : e.evalType;

  const renderEval = ({ item }: { item: Evaluation }) => (
    <View style={[styles.card, item.isArchived && styles.cardArchived]}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={[styles.evalTypeLabel, item.isArchived && styles.textMuted]}>
            {getEvalLabel(item)}
          </Text>
          <Text style={styles.evalDate}>{formatDate(item.evalDate)}</Text>
        </View>
        <View style={styles.measureBadge}>
          <Text style={styles.measureBadgeText}>{item.measures?.length ?? 0} measures</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        {!item.isArchived && (
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => onViewEval(item.id, item.evalType, item.customEvalType ?? '', item.evalDate)}
          >
            <Text style={styles.viewBtnText}>View →</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item)}>
          <Text style={styles.archiveBtnText}>{item.isArchived ? 'Unarchive' : 'Archive'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {student.lastName}, {student.firstName}
          </Text>
          {student.studentId ? (
            <Text style={styles.headerSub}>ID: {student.studentId}</Text>
          ) : null}
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.evalCountText}>
          {filtered.length} evaluation{filtered.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={[styles.archiveToggle, showArchived && styles.archiveToggleActive]}
          onPress={() => setShowArchived(v => !v)}
        >
          <Text style={[styles.archiveToggleText, showArchived && styles.archiveToggleTextActive]}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={PALETTE.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={renderEval}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No evaluations yet.</Text>
              <Text style={styles.emptyHint}>Tap "Add Evaluation" to get started.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ Add Evaluation</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={resetModal}
      >
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Add Evaluation</Text>

              <Text style={styles.fieldLabel}>Evaluation Type</Text>
              <View style={styles.typeRow}>
                {EVAL_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, newEvalType === t && styles.typeBtnActive]}
                    onPress={() => setNewEvalType(t)}
                  >
                    <Text style={[styles.typeBtnText, newEvalType === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newEvalType === 'Other' && (
                <TextInput
                  style={styles.input}
                  placeholder="Custom evaluation type"
                  placeholderTextColor={PALETTE.placeholder}
                  value={newCustomType}
                  onChangeText={setNewCustomType}
                />
              )}

              <Text style={styles.fieldLabel}>Evaluation Date</Text>
              <View style={styles.dateWrap}>
                <DatePickerField value={newEvalDate} onChange={setNewEvalDate} />
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleAddEval}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={PALETTE.white} />
                    : <Text style={styles.saveBtnText}>Add Evaluation</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  evalCountText: { fontSize: 13, color: PALETTE.muted, fontWeight: '500' },
  archiveToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
  },
  archiveToggleActive: { borderColor: PALETTE.accent, backgroundColor: PALETTE.accentLight },
  archiveToggleText: { fontSize: 12, color: PALETTE.muted, fontWeight: '500' },
  archiveToggleTextActive: { color: PALETTE.accent },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
    marginBottom: 10,
  },
  cardArchived: { opacity: 0.6 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardMeta: { flex: 1 },
  evalTypeLabel: { fontSize: 16, fontWeight: '600', color: PALETTE.text, marginBottom: 3 },
  textMuted: { color: PALETTE.muted },
  evalDate: { fontSize: 13, color: PALETTE.muted },
  measureBadge: {
    backgroundColor: PALETTE.bg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  measureBadgeText: { fontSize: 12, color: PALETTE.muted, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    flex: 1,
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewBtnText: { color: PALETTE.white, fontSize: 14, fontWeight: '600' },
  archiveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
  },
  archiveBtnText: { fontSize: 13, color: PALETTE.muted, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: PALETTE.muted, fontWeight: '500' },
  emptyHint: { fontSize: 13, color: PALETTE.placeholder, marginTop: 6 },
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: PALETTE.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: PALETTE.text, marginBottom: 20, letterSpacing: -0.2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: PALETTE.muted, marginBottom: 8, letterSpacing: 0.1 },
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
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  dateWrap: { marginBottom: 20 },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: PALETTE.muted, fontWeight: '500' },
  saveBtn: {
    flex: 2,
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: PALETTE.white, fontSize: 15, fontWeight: '600' },
});
