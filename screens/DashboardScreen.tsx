import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
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

export default function DashboardScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Student))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
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
      await addDoc(collection(db, 'students'), {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        studentId: form.studentId.trim(),
        notes: form.notes.trim(),
        userId: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
      });
      setForm(EMPTY_FORM);
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not add student. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (student: Student) => {
    Alert.alert(
      'Remove Student',
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
              Alert.alert('Error', 'Could not remove student.');
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.studentName}>{item.lastName}, {item.firstName}</Text>
        {item.studentId ? (
          <Text style={styles.studentIdText}>ID: {item.studentId}</Text>
        ) : null}
        <View style={styles.cardMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillLabel}>Last Eval</Text>
            <Text style={styles.metaPillValue}>None</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillLabel}>Evals</Text>
            <Text style={styles.metaPillValue}>0</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => confirmDelete(item)}
        style={styles.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Students</Text>
          <Text style={styles.headerSub}>{students.length} enrolled</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{students.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Last Eval</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          placeholderTextColor={PALETTE.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Student list */}
      {loading ? (
        <ActivityIndicator color={PALETTE.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          renderItem={renderStudent}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'No students match your search.' : 'No students yet.'}
              </Text>
              {!search.trim() && (
                <Text style={styles.emptyHint}>Tap "Add Student" to get started.</Text>
              )}
            </View>
          }
        />
      )}

      {/* Add Student FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ Add Student</Text>
      </TouchableOpacity>

      {/* Add Student bottom sheet */}
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
              <Text style={styles.sheetTitle}>Add Student</Text>

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
                    : <Text style={styles.saveBtnText}>Add Student</Text>}
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
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
  },
  signOutText: {
    fontSize: 13,
    color: PALETTE.muted,
    fontWeight: '500',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: PALETTE.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 16,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: PALETTE.text,
  },
  statLabel: {
    fontSize: 12,
    color: PALETTE.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: PALETTE.border,
    marginVertical: 4,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: PALETTE.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 13,
    fontSize: 15,
    color: PALETTE.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardBody: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.text,
    marginBottom: 2,
  },
  studentIdText: {
    fontSize: 13,
    color: PALETTE.muted,
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.bg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 4,
  },
  metaPillLabel: {
    fontSize: 11,
    color: PALETTE.muted,
    fontWeight: '500',
  },
  metaPillValue: {
    fontSize: 11,
    color: PALETTE.text,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  deleteBtnText: {
    fontSize: 22,
    color: PALETTE.placeholder,
    lineHeight: 24,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: PALETTE.muted,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    color: PALETTE.placeholder,
    marginTop: 6,
  },
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
  fabText: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: '600',
  },
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
