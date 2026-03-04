import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';

const PALETTE = {
  bg: '#F8F9FB',
  white: '#FFFFFF',
  accent: '#3B6FEB',
  accentLight: '#EEF3FD',
  border: '#E5E8EE',
  text: '#1A1D23',
  muted: '#6B7280',
  placeholder: '#9CA3AF',
  error: '#EF4444',
  rowAlt: '#FAFBFC',
};

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string;
  notes?: string;
  userId: string;
  createdAt: Timestamp | null;
}

interface AddForm {
  firstName: string;
  lastName: string;
  studentId: string;
  notes: string;
}

const EMPTY_FORM: AddForm = { firstName: '', lastName: '', studentId: '', notes: '' };

interface Props {
  onNavigate: (screen: 'dueDateCalculator' | 'scoreConverter' | 'bellCurveGraph') => void;
  onSelectStudent: (student: { id: string; firstName: string; lastName: string; studentId?: string }) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const TOOLS = [
  {
    key: 'dueDateCalculator' as const,
    icon: '📅',
    title: 'Due Date\nCalculator',
    desc: 'Calculate assessment deadlines',
  },
  {
    key: 'scoreConverter' as const,
    icon: '🔢',
    title: 'Score\nConverter',
    desc: 'Convert between score types',
  },
  {
    key: 'bellCurveGraph' as const,
    icon: '📊',
    title: 'Quick Bell\nCurve',
    desc: 'Visualize scores instantly',
  },
];

export default function DashboardScreen({ onNavigate, onSelectStudent }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [evalTypesMap, setEvalTypesMap] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState('');

  // Fetch current user's first name
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setFirstName(snap.data().firstName ?? '');
    });
  }, []);

  // Load students
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'students'),
      where('userId', '==', uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log('=== SNAPSHOT: received ===');
        console.log('Querying for userId:', uid);
        console.log('Document count:', snap.docs.length);
        snap.docs.forEach((d, i) => {
          const data = d.data();
          console.log(`  doc[${i}] id=${d.id} firstName=${data.firstName} lastName=${data.lastName} userId=${data.userId} createdAt=${data.createdAt?.seconds ?? 'null (pending)'}`);
        });
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Student))
          .sort((a, b) => (b.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER));
        setStudents(list);
        setLoading(false);
      },
      () => {
        Alert.alert('Error', 'Could not load students.');
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  // Batch-fetch eval types for all students when the list changes
  useEffect(() => {
    if (students.length === 0) {
      setEvalTypesMap({});
      return;
    }

    Promise.all(
      students.map(async (s) => {
        try {
          const snap = await getDocs(collection(db, 'students', s.id, 'evaluations'));
          const seen = new Set<string>();
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.isArchived) return;
            const label = data.evalType === 'Other' && data.customEvalType
              ? data.customEvalType
              : data.evalType;
            if (label) seen.add(label);
          });
          return { id: s.id, label: seen.size > 0 ? [...seen].join(', ') : 'None yet' };
        } catch {
          return { id: s.id, label: '—' };
        }
      })
    ).then(results => {
      const map: Record<string, string> = {};
      results.forEach(r => { map[r.id] = r.label; });
      setEvalTypesMap(map);
    });
  }, [students]);

  const filtered = search.trim()
    ? students.filter(s => {
        const haystack = `${s.lastName} ${s.firstName} ${s.studentId ?? ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
    : students;

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Required', 'First name and last name are required.');
      return;
    }
    setSaving(true);
    try {
      console.log('=== ADD CASE: starting ===');
      console.log('Current user UID:', auth.currentUser?.uid);
      console.log('Form data:', { firstName: form.firstName.trim(), lastName: form.lastName.trim(), studentId: form.studentId.trim() });
      const ref = await addDoc(collection(db, 'students'), {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        studentId: form.studentId.trim(),
        notes: form.notes.trim(),
        userId: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
      });
      console.log('=== ADD CASE: addDoc succeeded, doc id:', ref.id, '===');
      setForm(EMPTY_FORM);
      setModalVisible(false);
    } catch (error) {
      console.error('=== FIRESTORE WRITE ERROR:', error);
      Alert.alert('Error', String(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (student: Student) => {
    Alert.alert(
      'Remove Case',
      `Remove ${student.lastName}, ${student.firstName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'students', student.id));
            } catch {
              Alert.alert('Error', 'Could not remove case.');
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Could not sign out. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ── List header component ──────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Quick Tools */}
      <View style={styles.toolsSection}>
        <Text style={styles.sectionLabel}>Quick Tools</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsRow}
        >
          {TOOLS.map(tool => (
            <TouchableOpacity
              key={tool.key}
              style={styles.toolCard}
              onPress={() => onNavigate(tool.key)}
              activeOpacity={0.75}
            >
              <View style={styles.toolIconWrap}>
                <Text style={styles.toolIcon}>{tool.icon}</Text>
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.desc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* My Cases header */}
      <View style={styles.casesHeader}>
        <Text style={styles.casesTitle}>My Cases</Text>
        <TouchableOpacity style={styles.addCaseBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addCaseBtnText}>+ Add New Case</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID…"
          placeholderTextColor={PALETTE.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Table column headers */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colHeader, styles.colName]}>CASE</Text>
        <Text style={[styles.colHeader, styles.colDate]}>DATE ENTERED</Text>
        <Text style={[styles.colHeader, styles.colTests]}>TESTS USED</Text>
        <View style={styles.colDelete} />
      </View>
    </>
  );

  const renderRow = ({ item, index }: { item: Student; index: number }) => (
    <TouchableOpacity
      style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
      onPress={() => onSelectStudent(item)}
      activeOpacity={0.6}
    >
      <View style={styles.colName}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.lastName}, {item.firstName}
        </Text>
        {item.studentId ? (
          <Text style={styles.rowSubtext}>ID: {item.studentId}</Text>
        ) : null}
      </View>
      <Text style={[styles.rowCell, styles.colDate]} numberOfLines={1}>
        {formatTimestamp(item.createdAt)}
      </Text>
      <Text style={[styles.rowCell, styles.colTests, !evalTypesMap[item.id] && styles.rowCellMuted]} numberOfLines={2}>
        {evalTypesMap[item.id] ?? '—'}
      </Text>
      <TouchableOpacity
        style={styles.colDelete}
        onPress={() => confirmDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteIcon}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PsychGraphs</Text>
        <Text style={styles.headerGreeting}>
          {firstName ? `Hi, ${firstName}` : ''}
        </Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main list */}
      {loading ? (
        <ActivityIndicator color={PALETTE.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          renderItem={renderRow}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'No cases match your search.' : 'No cases yet.'}
              </Text>
              {!search.trim() && (
                <Text style={styles.emptyHint}>Tap "+ Add New Case" to get started.</Text>
              )}
            </View>
          }
        />
      )}

      {/* Add Case bottom sheet */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setModalVisible(false); setForm(EMPTY_FORM); }}
      >
        <View style={styles.sheetBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Add New Case</Text>

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="First Name"
                  placeholderTextColor={PALETTE.placeholder}
                  value={form.firstName}
                  onChangeText={v => setForm(f => ({ ...f, firstName: v }))}
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Last Name"
                  placeholderTextColor={PALETTE.placeholder}
                  value={form.lastName}
                  onChangeText={v => setForm(f => ({ ...f, lastName: v }))}
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Student ID (optional)"
                placeholderTextColor={PALETTE.placeholder}
                value={form.studentId}
                onChangeText={v => setForm(f => ({ ...f, studentId: v }))}
              />

              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Notes (optional)"
                placeholderTextColor={PALETTE.placeholder}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setModalVisible(false); setForm(EMPTY_FORM); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color={PALETTE.white} />
                    : <Text style={styles.saveBtnText}>Add Case</Text>}
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
  safe: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: PALETTE.muted,
    marginTop: 2,
  },
  headerGreeting: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.muted,
    fontWeight: '500',
    textAlign: 'center',
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  signOutText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },

  // ── Quick Tools ───────────────────────────────────────────────────────────
  toolsSection: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  toolsRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  toolCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
    width: 148,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  toolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: PALETTE.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  toolIcon: {
    fontSize: 18,
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.text,
    lineHeight: 17,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  toolDesc: {
    fontSize: 11,
    color: PALETTE.muted,
    lineHeight: 15,
  },

  // ── My Cases section ──────────────────────────────────────────────────────
  casesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  casesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.text,
    letterSpacing: -0.2,
  },
  addCaseBtn: {
    backgroundColor: PALETTE.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addCaseBtnText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: PALETTE.text,
  },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PALETTE.bg,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: PALETTE.placeholder,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: PALETTE.white,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  tableRowAlt: {
    backgroundColor: PALETTE.rowAlt,
  },
  colName: {
    flex: 2,
    paddingRight: 8,
  },
  colDate: {
    flex: 1.3,
    paddingRight: 8,
  },
  colTests: {
    flex: 1.6,
    paddingRight: 4,
  },
  colDelete: {
    width: 28,
    alignItems: 'center',
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.text,
  },
  rowSubtext: {
    fontSize: 11,
    color: PALETTE.muted,
    marginTop: 1,
  },
  rowCell: {
    fontSize: 12,
    color: PALETTE.muted,
  },
  rowCellMuted: {
    color: PALETTE.placeholder,
  },
  deleteIcon: {
    fontSize: 20,
    color: PALETTE.placeholder,
    lineHeight: 22,
  },

  // ── List chrome ───────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 40,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: PALETTE.muted,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: PALETTE.placeholder,
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
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
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.text,
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
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
  notesInput: {
    height: 80,
    paddingTop: 14,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    color: PALETTE.muted,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
