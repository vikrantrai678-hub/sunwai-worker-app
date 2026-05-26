import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Image,
  TextInput, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder, useAudioRecorderState,
  AudioModule, RecordingPresets,
} from 'expo-audio';
import { supabase } from '../lib/supabase';

const CATEGORY_LABEL = {
  salary: 'Salary',
  safety: 'Safety',
  interpersonal: 'Interpersonal',
  discrimination: 'Discrimination',
  workload: 'Workload',
  other: 'Other',
};

const THEME = {
  black: '#1A1A1A', gold: '#C4A882', goldLight: '#F0E6D6',
  goldDark: '#8A7155', white: '#FFFFFF', background: '#F8F7F5',
  border: '#E8E4DE', textSecondary: '#6B6560', textTertiary: '#9C9892',
  danger: '#E24B4A', dangerBg: '#FEF0F0',
  warning: '#BA7517', warningBg: '#FEF3E2',
};

const CATEGORIES = [
  { key:'salary',        icon:'💰', en:'Salary / Wages',    hi:'वेतन' },
  { key:'safety',        icon:'🛡️', en:'Safety hazard',     hi:'सुरक्षा' },
  { key:'interpersonal', icon:'🤝', en:'Interpersonal',     hi:'व्यक्तिगत' },
  { key:'discrimination',icon:'⚖️', en:'Discrimination',    hi:'भेदभाव' },
  { key:'workload',      icon:'⏰', en:'Workload / Shifts',  hi:'काम का बोझ' },
  { key:'other',         icon:'📋', en:'Other',             hi:'अन्य' },
];

export default function SubmitScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [lang, setLang]         = useState('hi');
  const [category, setCategory] = useState(null);
  const [description, setDesc]  = useState('');
  const [anonymous, setAnon]    = useState(false);
  const [submitting, setSub]    = useState(false);
  const [attachments, setAttach] = useState([]); // { type: 'photo'|'file'|'audio', uri, name? }

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const isHindi = lang === 'hi';
  const t = (en, hi) => (isHindi ? hi : en);
  const isSafety = ['safety', 'discrimination'].includes(category);

  useEffect(() => {
    (async () => {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        // permission may be re-requested later when user actually taps mic
      }
    })();
  }, []);

  const addAttachment = (a) => setAttach((prev) => [...prev, a]);
  const removeAttachment = (idx) =>
    setAttach((prev) => prev.filter((_, i) => i !== idx));

  const handleCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        t('Camera permission required', 'कैमरा अनुमति आवश्यक'),
        t(
          'Please enable camera access in Settings to attach photos.',
          'फोटो जोड़ने के लिए सेटिंग्स में कैमरा एक्सेस सक्षम करें।'
        )
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      addAttachment({ type: 'photo', uri: result.assets[0].uri });
    }
  };

  const handleAttach = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        t('Photos permission required', 'फोटो अनुमति आवश्यक'),
        t(
          'Please enable photo library access in Settings.',
          'कृपया सेटिंग्स में फोटो लाइब्रेरी एक्सेस सक्षम करें।'
        )
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      addAttachment({
        type: 'file',
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || 'image.jpg',
      });
    }
  };

  const handleMic = async () => {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
        // recorder.uri may briefly be null right after stop on Android — wait a tick
        let uri = recorder.uri;
        if (!uri) {
          await new Promise((r) => setTimeout(r, 250));
          uri = recorder.uri;
        }
        if (uri) {
          addAttachment({ type: 'audio', uri });
        } else {
          Alert.alert(
            t('Could not save recording', 'रिकॉर्डिंग सहेजी नहीं जा सकी'),
            t('Please try recording again.', 'कृपया फिर से रिकॉर्ड करें।')
          );
        }
      } catch (e) {
        Alert.alert(t('Recording error', 'रिकॉर्डिंग त्रुटि'), String(e?.message || e));
      }
      return;
    }
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        t('Microphone permission required', 'माइक्रोफ़ोन अनुमति आवश्यक'),
        t(
          'Please enable microphone access in Settings to record voice notes.',
          'वॉइस नोट रिकॉर्ड करने के लिए सेटिंग्स में माइक्रोफ़ोन एक्सेस सक्षम करें।'
        )
      );
      return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert(t('Recording error', 'रिकॉर्डिंग त्रुटि'), String(e?.message || e));
    }
  };

  const uploadAttachment = async (attachment, authUserId, grievanceId) => {
    const ext =
      attachment.type === 'audio' ? 'm4a' :
      (attachment.name?.split('.').pop()?.toLowerCase() || 'jpg');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = `${authUserId}/${grievanceId}/${fileName}`;

    const contentType =
      attachment.type === 'audio' ? 'audio/m4a' :
      ext === 'png' ? 'image/png' : 'image/jpeg';

    // Recommended RN pattern for Supabase Storage: read file as ArrayBuffer.
    const arrayBuffer = await fetch(attachment.uri).then((r) => r.arrayBuffer());

    const { error: upErr } = await supabase
      .storage
      .from('grievance-attachments')
      .upload(storagePath, arrayBuffer, { contentType, upsert: false });
    if (upErr) throw upErr;

    const { error: rowErr } = await supabase
      .from('grievance_attachments')
      .insert({
        grievance_id: grievanceId,
        kind: attachment.type,
        storage_path: storagePath,
        file_name: attachment.name || fileName,
      });
    if (rowErr) throw rowErr;
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('', t('Please select a category', 'कृपया एक श्रेणी चुनें'));
      return;
    }
    if (!description.trim()) {
      Alert.alert('', t('Please describe your grievance', 'कृपया अपनी शिकायत बताएं'));
      return;
    }
    setSub(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: worker } = await supabase
        .from('workers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const title = description.trim().slice(0, 80);

      const { data: inserted, error: insErr } = await supabase
        .from('grievances')
        .insert({
          worker_id: anonymous ? null : worker?.id || null,
          submitted_by_auth_id: user.id,
          is_anonymous: anonymous,
          category: CATEGORY_LABEL[category] || category,
          title,
          description: description.trim(),
          sla_days: ['safety', 'discrimination'].includes(category) ? 1 : 7,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const grievanceId = inserted.id;

      for (const a of attachments) {
        await uploadAttachment(a, user.id, grievanceId);
      }

      setSub(false);
      Alert.alert(
        '✅ ' + t('Submitted successfully!', 'सफलतापूर्वक दर्ज हुई!'),
        t(
          `Your grievance ID is ${grievanceId}. Track it in "My grievances".`,
          `आपकी शिकायत आईडी ${grievanceId} है। "मेरी शिकायतें" में ट्रैक करें।`
        ),
        [{
          text: t('OK', 'ठीक है'),
          onPress: () => navigation.navigate('Track', { focusId: grievanceId }),
        }]
      );
    } catch (e) {
      setSub(false);
      Alert.alert(
        t('Could not submit', 'दर्ज नहीं हो सका'),
        String(e?.message || e)
      );
    }
  };

  const isRecording = recorderState.isRecording;

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.black} translucent={false} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.monogram}>
          <Text style={s.monogramText}>C&R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('Submit grievance', 'शिकायत दर्ज करें')}</Text>
          <Text style={s.headerSub}>C & R Textiles</Text>
        </View>
        <TouchableOpacity
          style={s.langPill}
          onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        >
          <Text style={s.langText}>{isHindi ? 'EN' : 'हि'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* Safety banner */}
        {isSafety && (
          <View style={s.safetyBanner}>
            <Text style={s.safetyText}>
              ⚡ {t(
                'Safety & discrimination complaints are escalated to HR Manager within 1 hour.',
                'सुरक्षा और भेदभाव की शिकायतें 1 घंटे में एचआर प्रबंधक को भेजी जाती हैं।'
              )}
            </Text>
          </View>
        )}

        {/* Category */}
        <Text style={s.label}>{t('Category *', 'श्रेणी *')}</Text>
        <View style={s.catGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catItem, category === cat.key && s.catItemActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={s.catIcon}>{cat.icon}</Text>
              <Text style={[s.catLabel, category === cat.key && s.catLabelActive]}>
                {isHindi ? cat.hi : cat.en}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={s.label}>{t('Describe your grievance *', 'अपनी शिकायत बताएं *')}</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            placeholder={t('Type in Hindi or English...', 'हिंदी या अंग्रेजी में लिखें...')}
            placeholderTextColor={THEME.textTertiary}
            value={description}
            onChangeText={setDesc}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[s.voiceBtn, isRecording && s.voiceBtnRecording]}
            onPress={handleMic}
          >
            <Text style={{ fontSize: 22 }}>{isRecording ? '⏹️' : '🎙️'}</Text>
          </TouchableOpacity>
        </View>
        {isRecording && (
          <Text style={s.recordingHint}>
            ● {t('Recording... tap stop when done', 'रिकॉर्डिंग जारी... समाप्त होने पर रोकें')}
          </Text>
        )}

        {/* Attachments */}
        <Text style={s.label}>{t('Attachments (optional)', 'संलग्नक (वैकल्पिक)')}</Text>
        <View style={s.attachRow}>
          <TouchableOpacity style={s.attachBtn} onPress={handleCamera}>
            <Text style={s.attachBtnText}>📷 {t('Take photo', 'फोटो लें')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachBtn} onPress={handleAttach}>
            <Text style={s.attachBtnText}>📎 {t('Attach file', 'फाइल जोड़ें')}</Text>
          </TouchableOpacity>
        </View>

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <View style={s.chipWrap}>
            {attachments.map((a, idx) => (
              <View key={idx} style={s.chip}>
                {a.type === 'photo' || a.type === 'file' ? (
                  <Image source={{ uri: a.uri }} style={s.chipThumb} />
                ) : (
                  <Text style={s.chipIcon}>🎙️</Text>
                )}
                <Text style={s.chipLabel} numberOfLines={1}>
                  {a.type === 'audio'
                    ? t('Voice note', 'वॉइस नोट')
                    : a.type === 'photo'
                      ? t('Photo', 'फोटो')
                      : a.name || t('File', 'फाइल')}
                </Text>
                <TouchableOpacity
                  onPress={() => removeAttachment(idx)}
                  hitSlop={8}
                  style={s.chipClose}
                >
                  <Text style={s.chipCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Anonymous */}
        <View style={s.anonRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.anonTitle}>{t('Submit anonymously', 'गुमनाम रूप से दर्ज करें')}</Text>
            <Text style={s.anonSub}>
              {t('Your identity is hidden from HR', 'आपकी पहचान एचआर से छिपी रहेगी')}
            </Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnon}
            trackColor={{ false: THEME.border, true: THEME.gold }}
            thumbColor={THEME.white}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={s.submitBtnText}>
            {submitting
              ? t('Submitting...', 'दर्ज हो रही है...')
              : t('Submit grievance →', 'शिकायत दर्ज करें →')}
          </Text>
        </TouchableOpacity>

        <Text style={s.footerNote}>
          📍 A-19, Sector 60, Noida (U.P.) · C & R Textiles (P) Ltd
        </Text>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.background },
  header: {
    backgroundColor: THEME.black, flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { marginRight: 4 },
  backArrow: { color: THEME.gold, fontSize: 22 },
  monogram: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: THEME.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  monogramText: { fontSize: 10, fontWeight: '700', color: THEME.black },
  headerTitle: { fontSize: 13, fontWeight: '600', color: THEME.white },
  headerSub: { fontSize: 10, color: THEME.gold },
  langPill: {
    borderWidth: 0.5, borderColor: THEME.gold, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  langText: { fontSize: 12, color: THEME.gold },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  safetyBanner: {
    backgroundColor: '#FEF3E2', borderWidth: 1, borderColor: '#BA7517',
    borderRadius: 10, padding: 10,
  },
  safetyText: { fontSize: 12, color: '#BA7517', lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catItem: {
    width: '30%', flexGrow: 1, backgroundColor: THEME.white, borderRadius: 10,
    borderWidth: 0.5, borderColor: THEME.border, padding: 10, alignItems: 'center', gap: 4,
  },
  catItemActive: {
    backgroundColor: THEME.goldLight, borderColor: THEME.gold, borderWidth: 1.5,
  },
  catIcon: { fontSize: 22 },
  catLabel: { fontSize: 11, color: THEME.textSecondary, textAlign: 'center' },
  catLabelActive: { color: THEME.goldDark, fontWeight: '500' },
  inputRow: { flexDirection: 'row', gap: 8 },
  textInput: {
    flex: 1, backgroundColor: THEME.white, borderRadius: 10, borderWidth: 0.5,
    borderColor: THEME.border, padding: 12, fontSize: 14, color: '#1A1A1A', minHeight: 100,
  },
  voiceBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.goldLight,
    borderWidth: 1, borderColor: THEME.gold, alignItems: 'center',
    justifyContent: 'center', alignSelf: 'flex-end',
  },
  voiceBtnRecording: { backgroundColor: THEME.dangerBg, borderColor: THEME.danger },
  recordingHint: { fontSize: 12, color: THEME.danger, fontWeight: '500' },
  attachRow: { flexDirection: 'row', gap: 10 },
  attachBtn: {
    flex: 1, backgroundColor: THEME.white, borderRadius: 10, borderWidth: 0.5,
    borderColor: THEME.border, padding: 10, alignItems: 'center',
  },
  attachBtnText: { fontSize: 13, color: THEME.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.white,
    borderRadius: 20, borderWidth: 0.5, borderColor: THEME.border,
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4, gap: 6, maxWidth: '100%',
  },
  chipThumb: { width: 28, height: 28, borderRadius: 14 },
  chipIcon: { fontSize: 18, marginLeft: 6 },
  chipLabel: { fontSize: 12, color: THEME.textSecondary, maxWidth: 140 },
  chipClose: { paddingLeft: 2 },
  chipCloseText: { fontSize: 14, color: THEME.textTertiary, fontWeight: '600' },
  anonRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.white,
    borderRadius: 12, borderWidth: 0.5, borderColor: THEME.border, padding: 14, gap: 12,
  },
  anonTitle: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  anonSub: { fontSize: 11, color: THEME.textTertiary, marginTop: 2 },
  submitBtn: { backgroundColor: THEME.black, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnText: { color: THEME.gold, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  footerNote: { textAlign: 'center', fontSize: 11, color: THEME.textTertiary, marginBottom: 16 },
});
