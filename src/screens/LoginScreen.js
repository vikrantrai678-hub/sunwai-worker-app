import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, workerIdToEmail } from '../lib/supabase';

const THEME = {
  black: '#1A1A1A', gold: '#C4A882', goldLight: '#F0E6D6',
  goldDark: '#8A7155', white: '#FFFFFF', background: '#F8F7F5',
  border: '#E8E4DE', textSecondary: '#6B6560', textTertiary: '#9C9892',
  danger: '#E24B4A',
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [lang, setLang]   = useState('hi');
  const [workerId, setId] = useState('');
  const [pin, setPin]     = useState('');
  const [loading, setLoading] = useState(false);

  const isHindi = lang === 'hi';
  const t = (en, hi) => (isHindi ? hi : en);

  const handleLogin = async () => {
    const cleanId = workerId.trim().toUpperCase();
    if (!cleanId || !/[A-Z0-9]/.test(cleanId)) {
      Alert.alert(
        t('Invalid Worker ID', 'अमान्य कर्मचारी आईडी'),
        t('Please enter your Worker ID', 'कृपया अपनी कर्मचारी आईडी दर्ज करें')
      );
      return;
    }
    if (pin.length < 6) {
      Alert.alert(
        t('Invalid Password', 'अमान्य पासवर्ड'),
        t('Password must be at least 6 characters', 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए')
      );
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: workerIdToEmail(cleanId),
      password: pin,
    });
    setLoading(false);
    if (error) {
      Alert.alert(
        t('Login failed', 'लॉगिन विफल'),
        t(
          'Check your Worker ID and PIN, or contact HR.',
          'कर्मचारी आईडी और पिन जांचें, या एचआर से संपर्क करें।'
        )
      );
    }
    // on success, App.js auth listener will swap stacks
  };

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.black} translucent={false} />

      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.monogram}>
          <Text style={s.monogramText}>C&R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>सुनवाई · Sunwai</Text>
          <Text style={s.headerSub}>
            C & R Textiles · {t('Grievance Portal', 'शिकायत पोर्टल')}
          </Text>
        </View>
        <TouchableOpacity
          style={s.langPill}
          onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        >
          <Text style={s.langText}>{isHindi ? 'English' : 'हिंदी'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.welcome}>
            {t('Welcome', 'स्वागत है')}
          </Text>
          <Text style={s.subtitle}>
            {t(
              'Sign in with the Worker ID and PIN your HR team gave you.',
              'एचआर टीम द्वारा दी गई कर्मचारी आईडी और पिन से साइन इन करें।'
            )}
          </Text>

          <Text style={s.label}>{t('Worker ID', 'कर्मचारी आईडी')}</Text>
          <TextInput
            style={s.input}
            value={workerId}
            onChangeText={setId}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. W-0042 or T-001"
            placeholderTextColor={THEME.textTertiary}
          />

          <Text style={s.label}>{t('Password', 'पासवर्ड')}</Text>
          <TextInput
            style={s.input}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            placeholder="••••"
            placeholderTextColor={THEME.textTertiary}
          />

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={s.btnText}>
              {loading
                ? t('Signing in...', 'साइन इन हो रहा है...')
                : t('Sign in →', 'साइन इन करें →')}
            </Text>
          </TouchableOpacity>

          <Text style={s.help}>
            {t(
              'Forgot your PIN? Contact HR at the floor office.',
              'पिन भूल गए? एचआर से संपर्क करें।'
            )}
          </Text>

          <Text style={s.footerNote}>
            📍 A-19, Sector 60, Noida (U.P.) · C & R Textiles (P) Ltd
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.background },
  header: {
    backgroundColor: THEME.black, flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 16, paddingBottom: 12,
  },
  monogram: {
    width: 32, height: 32, borderRadius: 7, backgroundColor: THEME.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  monogramText: { fontSize: 11, fontWeight: '700', color: THEME.black },
  headerTitle: { fontSize: 13, fontWeight: '600', color: THEME.white },
  headerSub: { fontSize: 10, color: THEME.gold },
  langPill: {
    borderWidth: 0.5, borderColor: THEME.gold, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  langText: { fontSize: 12, color: THEME.gold },
  body: { padding: 20, gap: 12 },
  welcome: { fontSize: 22, fontWeight: '600', color: '#1A1A1A', marginTop: 12 },
  subtitle: { fontSize: 13, color: THEME.textSecondary, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '500', color: '#1A1A1A', marginTop: 4 },
  input: {
    backgroundColor: THEME.white, borderRadius: 10, borderWidth: 0.5,
    borderColor: THEME.border, padding: 14, fontSize: 16, color: '#1A1A1A',
  },
  btn: {
    backgroundColor: THEME.black, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 12,
  },
  btnText: { color: THEME.gold, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  help: { fontSize: 12, color: THEME.textTertiary, textAlign: 'center', marginTop: 8 },
  footerNote: {
    textAlign: 'center', fontSize: 11, color: THEME.textTertiary,
    marginTop: 24, marginBottom: 16,
  },
});
