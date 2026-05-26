import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const THEME = {
  black: '#1A1A1A', gold: '#C4A882', goldLight: '#F0E6D6',
  goldDark: '#8A7155', white: '#FFFFFF', background: '#F8F7F5',
  border: '#E8E4DE', textSecondary: '#6B6560', textTertiary: '#9C9892',
  success: '#1D9E75', successBg: '#E8F5F0',
  danger: '#E24B4A', dangerBg: '#FEF0F0',
  warning: '#BA7517', warningBg: '#FEF3E2',
};

const COMPANY = {
  name: 'C & R Textiles',
  tagline: 'Elevating your everyday',
  director: 'Vikrant Rai',
  address: 'A-19, Sector 60, Noida (U.P.), India',
};

const STATUS = {
  open:        { en: 'Open',        hi: 'खुली',       bg: '#F0E6D6', color: '#8A7155' },
  in_progress: { en: 'In progress', hi: 'प्रगति पर',  bg: '#F0E6D6', color: '#8A7155' },
  escalated:   { en: 'Escalated',   hi: 'बढ़ाई गई',   bg: '#FEF0F0', color: '#E24B4A' },
  resolved:    { en: 'Resolved',    hi: 'समाधान हुआ', bg: '#E8F5F0', color: '#1D9E75' },
};

const daysSince = (iso) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [lang, setLang]       = useState('hi');
  const [worker, setWorker]   = useState(null);
  const [grievances, setGrv]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isHindi = lang === 'hi';
  const t = (en, hi) => (isHindi ? hi : en);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: w }, { data: g }] = await Promise.all([
      supabase.from('workers').select('*').eq('auth_user_id', user.id).maybeSingle(),
      supabase.from('grievances').select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setWorker(w);
    setGrv(g || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('Sign out?', 'साइन आउट?'),
      t('You will need your Worker ID and PIN to sign in again.',
        'पुनः साइन इन के लिए कर्मचारी आईडी और पिन चाहिए।'),
      [
        { text: t('Cancel', 'रद्द'), style: 'cancel' },
        { text: t('Sign out', 'साइन आउट'), style: 'destructive',
          onPress: () => supabase.auth.signOut() },
      ]
    );
  };

  const awaitingFeedback = grievances.filter(g => g.status === 'resolved').length;

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.black} translucent={false} />

      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerLeft}>
          <View style={s.monogram}><Text style={s.monogramText}>C&R</Text></View>
          <View>
            <Text style={s.headerTitle}>सुनवाई · Sunwai</Text>
            <Text style={s.headerSub}>
              {COMPANY.name} · {t('Grievance Portal', 'शिकायत पोर्टल')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.langPill}
          onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        >
          <Text style={s.langText}>{isHindi ? 'English' : 'हिंदी'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={THEME.gold} size="large" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.gold}
            />
          }
        >
          <View style={s.banner}>
            <Text style={s.bannerGreet}>
              {t('Hello', 'नमस्ते')}, {worker?.name || t('Worker', 'कर्मचारी')} 👋
            </Text>
            <Text style={s.bannerMeta}>
              {t('Worker ID', 'कर्मचारी आईडी')}: {worker?.id || '—'}
              {worker?.floor ? `  ·  ${worker.floor}` : ''}
              {worker?.shift ? `  ·  ${worker.shift} ${t('Shift', 'पाली')}` : ''}
            </Text>
          </View>

          <View style={s.grid}>
            <TouchableOpacity
              style={[s.gridItem, s.gridItemGold]}
              onPress={() => navigation.navigate('Submit')}
            >
              <Text style={s.gridIcon}>✏️</Text>
              <Text style={[s.gridLabel, { color: THEME.goldDark }]}>
                {t('New grievance', 'नई शिकायत')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.gridItem}
              onPress={() => navigation.navigate('Track')}
            >
              <Text style={s.gridIcon}>🔍</Text>
              <Text style={s.gridLabel}>{t('Track status', 'स्थिति जांचें')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.gridItem}>
              <Text style={s.gridIcon}>🔔</Text>
              <Text style={s.gridLabel}>{t('Notifications', 'सूचनाएं')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.gridItem} onPress={handleSignOut}>
              <Text style={s.gridIcon}>🚪</Text>
              <Text style={s.gridLabel}>{t('Sign out', 'साइन आउट')}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.locationRow}>
            <Text style={s.locationPin}>📍</Text>
            <Text style={s.locationText}>{COMPANY.address}</Text>
          </View>

          {awaitingFeedback > 0 && (
            <View style={s.alertBox}>
              <Text style={s.alertText}>
                ⚠️  {awaitingFeedback} {t(
                  'grievance(s) awaiting your feedback',
                  'शिकायत(एं) आपकी प्रतिक्रिया की प्रतीक्षा में'
                )}
              </Text>
            </View>
          )}

          <Text style={s.sectionTitle}>
            {t('Recent grievances', 'हाल की शिकायतें')}
          </Text>

          {grievances.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyText}>
                {t(
                  'No grievances yet. Tap "New grievance" to submit your first one.',
                  'अभी कोई शिकायत नहीं। पहली दर्ज करने के लिए "नई शिकायत" दबाएं।'
                )}
              </Text>
            </View>
          ) : (
            grievances.map(g => {
              const passed = daysSince(g.created_at);
              const st = STATUS[g.status] || STATUS.open;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={s.card}
                  onPress={() => navigation.navigate('Track', { focusId: g.id })}
                >
                  <View style={s.cardTop}>
                    <Text style={s.cardId}>{g.id} · {g.category}</Text>
                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                      <Text style={[s.badgeText, { color: st.color }]}>
                        {isHindi ? st.hi : st.en}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle} numberOfLines={1}>{g.title}</Text>
                  <View style={s.slaRow}>
                    <View style={s.slaTrack}>
                      <View style={[s.slaFill, {
                        width: `${Math.min((passed / g.sla_days) * 100, 100)}%`,
                        backgroundColor: g.status === 'resolved' ? THEME.success :
                          passed / g.sla_days >= 0.85 ? THEME.danger : THEME.gold,
                      }]} />
                    </View>
                    <Text style={s.slaMeta}>
                      {g.status === 'resolved'
                        ? '✓ ' + t('Done', 'पूर्ण')
                        : `${t('Day', 'दिन')} ${passed}/${g.sla_days}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={s.footer}>
            <Text style={s.footerText}>{COMPANY.name} · {COMPANY.tagline}</Text>
            <Text style={s.footerSub}>Director: {COMPANY.director}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor: THEME.background },
  header: {
    backgroundColor: THEME.black, flexDirection:'row', justifyContent:'space-between',
    alignItems:'center', paddingHorizontal:16, paddingBottom:12,
  },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:10 },
  monogram: { width:32, height:32, borderRadius:7, backgroundColor: THEME.gold,
    alignItems:'center', justifyContent:'center' },
  monogramText: { fontSize:11, fontWeight:'700', color: THEME.black },
  headerTitle: { fontSize:13, fontWeight:'600', color: THEME.white },
  headerSub: { fontSize:10, color: THEME.gold },
  langPill: { borderWidth:0.5, borderColor: THEME.gold, borderRadius:20,
    paddingHorizontal:12, paddingVertical:4 },
  langText: { fontSize:12, color: THEME.gold },
  scroll: { flex:1 },
  scrollContent: { padding:16, gap:12 },
  banner: { backgroundColor: THEME.goldLight, borderRadius:12, padding:14 },
  bannerGreet: { fontSize:16, fontWeight:'600', color:'#5A4530' },
  bannerMeta: { fontSize:12, color: THEME.goldDark, marginTop:2 },
  grid: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  gridItem: { width:'47%', backgroundColor: THEME.white, borderRadius:12,
    borderWidth:0.5, borderColor: THEME.border, padding:14, alignItems:'center' },
  gridItemGold: { backgroundColor: THEME.goldLight, borderColor: THEME.gold },
  gridIcon: { fontSize:26, marginBottom:6 },
  gridLabel: { fontSize:13, color: THEME.textSecondary, textAlign:'center' },
  locationRow: { flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor: THEME.white, borderRadius:10, borderWidth:0.5,
    borderColor: THEME.border, padding:10 },
  locationPin: { fontSize:14 },
  locationText: { fontSize:12, color: THEME.textSecondary, flex:1 },
  alertBox: { backgroundColor: THEME.warningBg, borderWidth:0.5,
    borderColor: THEME.warning, borderRadius:10, padding:10 },
  alertText: { fontSize:12, color: THEME.warning },
  sectionTitle: { fontSize:15, fontWeight:'500', color:'#1A1A1A', marginTop:4 },
  emptyBox: { alignItems:'center', padding:32, backgroundColor: THEME.white,
    borderRadius:12, borderWidth:0.5, borderColor: THEME.border, gap:8 },
  emptyIcon: { fontSize:36 },
  emptyText: { fontSize:13, color: THEME.textSecondary, textAlign:'center' },
  card: { backgroundColor: THEME.white, borderRadius:12, borderWidth:0.5,
    borderColor: THEME.border, padding:14, gap:6 },
  cardTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  cardId: { fontSize:11, color: THEME.textTertiary },
  cardTitle: { fontSize:13, fontWeight:'500', color:'#1A1A1A' },
  badge: { borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  badgeText: { fontSize:10, fontWeight:'500' },
  slaRow: { flexDirection:'row', alignItems:'center', gap:8 },
  slaTrack: { flex:1, height:4, backgroundColor:'#F0EDE8', borderRadius:2 },
  slaFill: { height:4, borderRadius:2 },
  slaMeta: { fontSize:11, color: THEME.textTertiary, minWidth:60 },
  footer: { alignItems:'center', paddingVertical:20, gap:4 },
  footerText: { fontSize:12, color: THEME.textTertiary },
  footerSub: { fontSize:11, color: THEME.textTertiary },
});
