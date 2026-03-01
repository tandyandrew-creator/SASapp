import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

const ROLES = ['School Psychologist', 'SLP', 'NeuroPsych', 'Administrator', 'Other'] as const;
type Role = (typeof ROLES)[number] | '';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  phone: string;
  smsConsent: boolean;
  school: string;
  district: string;
  role: Role;
  roleCustom: string;
}

const INITIAL_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirm: '',
  phone: '',
  smsConsent: false,
  school: '',
  district: '',
  role: '',
  roleCustom: '',
};

export default function SignUpScreen({ onSwitch }: { onSwitch: () => void }) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSignUp = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.role) {
      setError('Please select a role.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        smsConsent: form.smsConsent,
        school: form.school.trim(),
        district: form.district.trim(),
        role: form.role,
        roleCustom: form.role === 'Other' ? form.roleCustom.trim() : '',
        createdAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError('Could not create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>PsychGraphs</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {/* Trust badge row */}
          <View style={styles.badgeRow}>
            {(['FERPA Compliant', 'Secure Cloud Storage', '2FA Enabled'] as const).map(badge => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>

          {/* Name row */}
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="First Name"
              placeholderTextColor={PALETTE.placeholder}
              value={form.firstName}
              onChangeText={v => setField('firstName', v)}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Last Name"
              placeholderTextColor={PALETTE.placeholder}
              value={form.lastName}
              onChangeText={v => setField('lastName', v)}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={PALETTE.placeholder}
            value={form.email}
            onChangeText={v => setField('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={PALETTE.placeholder}
            value={form.password}
            onChangeText={v => setField('password', v)}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={PALETTE.placeholder}
            value={form.confirm}
            onChangeText={v => setField('confirm', v)}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={PALETTE.placeholder}
            value={form.phone}
            onChangeText={v => setField('phone', v)}
            keyboardType="phone-pad"
          />

          {/* SMS consent checkbox */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setField('smsConsent', !form.smsConsent)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, form.smsConsent && styles.checkboxChecked]}>
              {form.smsConsent && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              I consent to receive texts for 2FA verification
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="School / Department Name (optional)"
            placeholderTextColor={PALETTE.placeholder}
            value={form.school}
            onChangeText={v => setField('school', v)}
          />

          <TextInput
            style={styles.input}
            placeholder="District / Company Name (optional)"
            placeholderTextColor={PALETTE.placeholder}
            value={form.district}
            onChangeText={v => setField('district', v)}
          />

          {/* Role dropdown trigger */}
          <TouchableOpacity
            style={[styles.input, styles.dropdownTrigger]}
            onPress={() => setRoleOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={form.role ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {form.role || 'Role'}
            </Text>
            <Text style={styles.dropdownArrow}>▾</Text>
          </TouchableOpacity>

          {form.role === 'Other' && (
            <TextInput
              style={styles.input}
              placeholder="Describe your role"
              placeholderTextColor={PALETTE.placeholder}
              value={form.roleCustom}
              onChangeText={v => setField('roleCustom', v)}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
            {loading
              ? <ActivityIndicator color={PALETTE.white} />
              : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
            <Text style={styles.switchText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Role picker modal */}
      <Modal
        visible={roleOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRoleOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Role</Text>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleOption, form.role === r && styles.roleOptionSelected]}
                onPress={() => { setField('role', r); setRoleOpen(false); }}
              >
                <Text style={[styles.roleOptionText, form.role === r && styles.roleOptionTextSelected]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },
  scroll: {
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: PALETTE.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: PALETTE.muted,
    marginBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: PALETTE.accentLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.accent,
    letterSpacing: 0.3,
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
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: PALETTE.accent,
    borderColor: PALETTE.accent,
  },
  checkmark: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.text,
    lineHeight: 20,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    fontSize: 16,
    color: PALETTE.text,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: PALETTE.placeholder,
  },
  dropdownArrow: {
    fontSize: 16,
    color: PALETTE.muted,
  },
  button: {
    backgroundColor: PALETTE.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: PALETTE.error,
    marginBottom: 16,
    fontSize: 14,
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: PALETTE.muted,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalSheet: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    padding: 8,
    width: '100%',
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.muted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  roleOptionSelected: {
    backgroundColor: PALETTE.accentLight,
  },
  roleOptionText: {
    fontSize: 16,
    color: PALETTE.text,
  },
  roleOptionTextSelected: {
    color: PALETTE.accent,
    fontWeight: '600',
  },
});
