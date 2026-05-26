import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, TextInput, Image,
  ActivityIndicator, RefreshControl, Linking,
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

const STATUS = {
  open:        { en: 'Open',        hi: 'खुली',       bg: '#F0E6D6', color: '#8A7155' },
  in_progress: { en: 'In progress', hi: 'प्रगति पर',  bg: '#F0E6D6', color: '#8A7155' },
  escalated:   { en: 'Escalated',   hi: 'बढ़ाई गई',   bg: '#FEF0F0', color: '#E24B4A' },
  resolved:    { en: 'Resolved',    hi: 'समाधान हुआ', bg: '#E8F5F0', color: '#1D9E75' },
};

const FILTERS = [
  { key: 'all',         en: 'All',        hi: 'सभी' },
  { key: 'in_progress', en: 'In progress',hi: 'प्रगति पर' },
  { key: 'escalated',   en: 'Escalated',  hi: 'बढ़ाई गई' },
  { key: 'resolved',    en: 'Resolved',   hi: 'समाधान हुआ' },
];

const daysSince = (iso) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export default function TrackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const focusId = route?.params?.focusId;

  const [lang, setLang]       = useState('hi');
  const [filter, setFilter]   = useState('all');
  const [query, setQuery]     = useState('');
  const [selected, setSelect] = useState(null);
  const [grievances, setGrv]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [attachments, setAttach] = useState([]);

  const isHindi = lang === 'hi';
  const t = (en, hi) => (isHindi ? hi : en);

  const loadList = useCallback(async () => {
    const { data, error } = await supabase
      .from('grievances')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setGrv(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadList(); }, [loadList]));

  // If navigated with focusId, open that grievance's detail once data loads
  useEffect(() => {
    if (focusId && grievances.length > 0 && !selected) {
      const g = grievances.find((x) => x.id === focusId);
      if (g) openDetail(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, grievances]);

  const openDetail = async (g) => {
    setSelect(g);
    setDetailLoading(true);
    setTimeline([]);
    setAttach([]);
    const [{ data: tl }, { data: atts }] = await Promise.all([
      supabase.from('grievance_timeline')
        .select('*').eq('grievance_id', g.id)
        .order('created_at', { ascending: true }),
      supabase.from('grievance_attachments')
        .select('*').eq('grievance_id', g.id)
        .order('created_at', { ascending: true }),
    ]);
    // get signed URLs for each attachment so we can display/play
    const withUrls = await Promise.all(
      (atts || []).map(async (a) => {
        const { data: signed } = await supabase
          .storage
          .from('grievance-attachments')
          .createSignedUrl(a.storage_path, 60 * 60);
        return { ...a, url: signed?.signedUrl };
      })
    );
    setTimeline(tl || []);
    setAttach(withUrls);
    setDetailLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadList();
    if (selected) {
      const fresh = (await supabase.from('grievances').select('*').eq('id', selected.id).maybeSingle()).data;
      if (fresh) await openDetail(fresh);
    }
    setRefreshing(false);
  };

  const filtered = grievances.filter((g) => {
    if (filter !== 'all' && g.status !== filter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        g.id.toLowerCase().includes(q) ||
        (g.title || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ---------- Detail view ----------
  if (selected) {
    const st = STATUS[selected.status] || STATUS.open;
    const passed = daysSince(selected.created_at);
    return (
      <View style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.black} translucent={false} />

        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setSelect(null)} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={s.monogram}>
            <Text style={s.monogramText}>C&R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{selected.id}</Text>
            <Text style={s.headerSub}>C & R Textiles</Text>
          </View>
          <TouchableOpacity
            style={s.langPill}
            onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
          >
            <Text style={s.langText}>{isHindi ? 'EN' : 'हि'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.gold} />}
        >
          <View style={s.detailCard}>
            <View style={s.cardTop}>
              <Text style={s.cardId}>{selected.id} · {selected.category}</Text>
              <View style={[s.badge, { backgroundColor: st.bg }]}>
                <Text style={[s.badgeText, { color: st.color }]}>
                  {isHindi ? st.hi : st.en}
                </Text>
              </View>
            </View>
            <Text style={s.detailTitle}>{selected.title}</Text>
            <Text style={s.detailBody}>{selected.description}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{t('Assigned to', 'सौंपा गया')}</Text>
              <Text style={s.metaValue}>
                {selected.assigned_to || t('Unassigned', 'अनिर्धारित')}
              </Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{t('Submitted on', 'दर्ज तिथि')}</Text>
              <Text style={s.metaValue}>{formatDate(selected.created_at)}</Text>
            </View>
            {selected.is_anonymous && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{t('Submitted as', 'दर्ज रूप से')}</Text>
                <Text style={s.metaValue}>{t('Anonymous', 'गुमनाम')}</Text>
              </View>
            )}
            <View style={s.slaRow}>
              <View style={s.slaTrack}>
                <View style={[s.slaFill, {
                  width: `${Math.min((passed / selected.sla_days) * 100, 100)}%`,
                  backgroundColor: selected.status === 'resolved' ? THEME.success :
                    passed / selected.sla_days >= 0.85 ? THEME.danger : THEME.gold,
                }]} />
              </View>
              <Text style={s.slaMeta}>
                {selected.status === 'resolved'
                  ? '✓ ' + t('Done', 'पूर्ण')
                  : `${t('Day', 'दिन')} ${passed}/${selected.sla_days}`}
              </Text>
            </View>
          </View>

          {detailLoading ? (
            <ActivityIndicator color={THEME.gold} style={{ marginVertical: 12 }} />
          ) : (
            <>
              {attachments.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>{t('Attachments', 'संलग्नक')}</Text>
                  <View style={s.attachGrid}>
                    {attachments.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        style={s.attachItem}
                        onPress={() => a.url && Linking.openURL(a.url)}
                      >
                        {a.kind === 'audio' ? (
                          <View style={s.attachAudio}>
                            <Text style={{ fontSize: 26 }}>🎙️</Text>
                            <Text style={s.attachAudioText}>
                              {t('Tap to play', 'सुनने के लिए दबाएं')}
                            </Text>
                          </View>
                        ) : a.url ? (
                          <Image source={{ uri: a.url }} style={s.attachThumb} />
                        ) : (
                          <View style={s.attachThumb} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.sectionTitle}>{t('Timeline', 'टाइमलाइन')}</Text>
              <View style={s.timelineBox}>
                {timeline.map((step, idx) => (
                  <View key={step.id} style={s.timelineRow}>
                    <View style={s.timelineLeft}>
                      <View style={[
                        s.timelineDot,
                        idx === timeline.length - 1 && s.timelineDotActive,
                      ]} />
                      {idx < timeline.length - 1 && <View style={s.timelineLine} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 14 }}>
                      <Text style={s.timelineText}>
                        {isHindi ? step.event_hi : step.event_en}
                      </Text>
                      <Text style={s.timelineDate}>{formatDate(step.created_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={s.footerNote}>
            📍 A-19, Sector 60, Noida (U.P.) · C & R Textiles (P) Ltd
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ---------- List view ----------
  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.black} translucent={false} />

      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.monogram}>
          <Text style={s.monogramText}>C&R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('Track grievances', 'शिकायतें ट्रैक करें')}</Text>
          <Text style={s.headerSub}>C & R Textiles</Text>
        </View>
        <TouchableOpacity
          style={s.langPill}
          onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        >
          <Text style={s.langText}>{isHindi ? 'EN' : 'हि'}</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.gold} />}
        >
          <TextInput
            style={s.searchInput}
            placeholder={t('Search by ID or keyword...', 'आईडी या शब्द से खोजें...')}
            placeholderTextColor={THEME.textTertiary}
            value={query}
            onChangeText={setQuery}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterPill, filter === f.key && s.filterPillActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
                  {isHindi ? f.hi : f.en}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyText}>
                {query || filter !== 'all'
                  ? t('No grievances match this filter', 'इस फ़िल्टर में कोई शिकायत नहीं')
                  : t(
                      'No grievances yet. Submit your first one from the home screen.',
                      'अभी कोई शिकायत नहीं। होम स्क्रीन से अपनी पहली शिकायत दर्ज करें।'
                    )}
              </Text>
            </View>
          ) : (
            filtered.map((g) => {
              const st = STATUS[g.status] || STATUS.open;
              const passed = daysSince(g.created_at);
              return (
                <TouchableOpacity key={g.id} style={s.card} onPress={() => openDetail(g)}>
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

          <Text style={s.footerNote}>
            📍 A-19, Sector 60, Noida (U.P.) · C & R Textiles (P) Ltd
          </Text>
        </ScrollView>
      )}
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
  scrollContent: { padding: 16, gap: 12 },
  searchInput: {
    backgroundColor: THEME.white, borderRadius: 10, borderWidth: 0.5,
    borderColor: THEME.border, padding: 12, fontSize: 13, color: '#1A1A1A',
  },
  filterRow: { gap: 8, paddingVertical: 2, paddingRight: 16 },
  filterPill: {
    backgroundColor: THEME.white, borderRadius: 20, borderWidth: 0.5,
    borderColor: THEME.border, paddingHorizontal: 14, paddingVertical: 6,
  },
  filterPillActive: { backgroundColor: THEME.black, borderColor: THEME.black },
  filterText: { fontSize: 12, color: THEME.textSecondary },
  filterTextActive: { color: THEME.gold, fontWeight: '500' },
  card: {
    backgroundColor: THEME.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: THEME.border, padding: 14, gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { fontSize: 11, color: THEME.textTertiary },
  cardTitle: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '500' },
  slaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  slaTrack: { flex: 1, height: 4, backgroundColor: '#F0EDE8', borderRadius: 2 },
  slaFill: { height: 4, borderRadius: 2 },
  slaMeta: { fontSize: 11, color: THEME.textTertiary, minWidth: 60 },
  emptyBox: {
    alignItems: 'center', padding: 32, backgroundColor: THEME.white,
    borderRadius: 12, borderWidth: 0.5, borderColor: THEME.border, gap: 8,
  },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 13, color: THEME.textSecondary, textAlign: 'center' },
  detailCard: {
    backgroundColor: THEME.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: THEME.border, padding: 14, gap: 8,
  },
  detailTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', marginVertical: 4 },
  detailBody: { fontSize: 13, color: THEME.textSecondary, lineHeight: 18, marginBottom: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 12, color: THEME.textTertiary },
  metaValue: { fontSize: 12, color: '#1A1A1A', fontWeight: '500' },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', marginTop: 6 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attachItem: {
    width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
    borderWidth: 0.5, borderColor: THEME.border, backgroundColor: THEME.white,
  },
  attachThumb: { width: '100%', height: '100%' },
  attachAudio: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.goldLight, gap: 2,
  },
  attachAudioText: { fontSize: 9, color: THEME.goldDark, textAlign: 'center', paddingHorizontal: 4 },
  timelineBox: {
    backgroundColor: THEME.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: THEME.border, padding: 14,
  },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 14 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.gold, marginTop: 2,
  },
  timelineDotActive: { backgroundColor: THEME.success },
  timelineLine: { width: 1, flex: 1, backgroundColor: THEME.border, marginTop: 2 },
  timelineText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  timelineDate: { fontSize: 11, color: THEME.textTertiary, marginTop: 2 },
  footerNote: {
    textAlign: 'center', fontSize: 11, color: THEME.textTertiary,
    marginTop: 8, marginBottom: 16,
  },
});
