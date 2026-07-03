import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Circle, G, Rect, Text as SvgText } from "react-native-svg";
import { api } from "@/src/api";
import { COLORS, GRADIENTS } from "@/src/theme";
import { buildKpiHtml, exportPdf, printHtml } from "@/src/reportExport";

type Kpi = {
  employee_id: string;
  employee_name: string;
  total_activities: number;
  approved: number;
  approval_rate: number;
  avg_turnaround_days: number;
  kpi_score: number;
  rating: string;
};

const RATING_COLORS: Record<string, string> = {
  "ممتاز": "#12B76A",
  "جيد جداً": "#2E90FA",
  "جيد": "#F79009",
  "يحتاج تحسين": "#F04438",
};

export default function KpiDashboard() {
  const router = useRouter();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setKpis(await api.get<Kpi[]>("/reports/kpis"));
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const stats = useMemo(() => {
    const total = kpis.length;
    const avg = total ? Math.round(kpis.reduce((s, k) => s + k.kpi_score, 0) / total) : 0;
    const topApproval = total ? Math.max(...kpis.map((k) => k.approval_rate)) : 0;
    const totalActs = kpis.reduce((s, k) => s + k.total_activities, 0);
    const buckets: Record<string, number> = {
      "ممتاز": 0, "جيد جداً": 0, "جيد": 0, "يحتاج تحسين": 0,
    };
    for (const k of kpis) buckets[k.rating] = (buckets[k.rating] || 0) + 1;
    return { total, avg, topApproval, totalActs, buckets };
  }, [kpis]);

  return (
    <View style={styles.container} testID="kpi-dashboard">
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>لوحة مؤشرات الأداء</Text>
              <Text style={styles.headerSub}>KPI Dashboard</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                testID="export-kpi"
                style={styles.actionBtn}
                onPress={() => exportPdf(buildKpiHtml(kpis), "kpi-dashboard")}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                testID="print-kpi"
                style={styles.actionBtn}
                onPress={() => printHtml(buildKpiHtml(kpis))}
              >
                <Ionicons name="print-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero KPI gauge */}
          <View style={styles.gaugeWrap} testID="avg-gauge">
            <Gauge value={stats.avg} />
            <View style={styles.gaugeInfo}>
              <Text style={styles.gaugeLabel}>متوسط الأداء العام</Text>
              <Text style={styles.gaugeValue}>{stats.avg}<Text style={styles.gaugeUnit}>/100</Text></Text>
              <View style={styles.gaugeMeta}>
                <View style={styles.gaugeMetaItem}>
                  <Ionicons name="people" size={12} color="#cbd5e1" />
                  <Text style={styles.gaugeMetaText}>{stats.total} موظفون</Text>
                </View>
                <View style={styles.gaugeMetaItem}>
                  <Ionicons name="documents" size={12} color="#cbd5e1" />
                  <Text style={styles.gaugeMetaText}>{stats.totalActs} نشاط</Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Distribution card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>توزيع تقييمات الموظفين</Text>
            <Ionicons name="pie-chart-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.distRow}>
            <Donut data={stats.buckets} />
            <View style={{ flex: 1, marginRight: 12 }}>
              {Object.entries(stats.buckets).map(([rating, count]) => (
                <View key={rating} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: RATING_COLORS[rating] }]} />
                  <Text style={styles.legendLabel}>{rating}</Text>
                  <Text style={styles.legendCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Top performers */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>أعلى 5 موظفين أداءً</Text>
            <Ionicons name="trophy" size={18} color={COLORS.gold} />
          </View>
          <TopBars data={kpis.slice(0, 5)} />
        </View>

        {/* All employees */}
        <Text style={styles.sectionTitle}>جميع الموظفين ({kpis.length})</Text>
        {kpis.map((k, idx) => (
          <View key={k.employee_id} style={styles.empRow} testID={`kpi-row-${k.employee_id}`}>
            <View style={[styles.rank, { backgroundColor: idx < 3 ? COLORS.gold : COLORS.primary }]}>
              <Text style={styles.rankText}>#{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{k.employee_name}</Text>
              <View style={[styles.ratingChip, { backgroundColor: RATING_COLORS[k.rating] + "20" }]}>
                <Text style={[styles.ratingText, { color: RATING_COLORS[k.rating] }]}>{k.rating}</Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[RATING_COLORS[k.rating], RATING_COLORS[k.rating] + "AA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${k.kpi_score}%` }]}
                />
              </View>
              <View style={styles.miniStats}>
                <Text style={styles.miniStat}>📋 {k.total_activities}</Text>
                <Text style={styles.miniStat}>✅ {k.approved}</Text>
                <Text style={styles.miniStat}>📊 {k.approval_rate}%</Text>
              </View>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{k.kpi_score}</Text>
              <Text style={styles.scoreLabel}>KPI</Text>
            </View>
          </View>
        ))}
        {kpis.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={54} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textMuted }}>لا توجد بيانات بعد</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ------------- SVG Components ---------------
function Gauge({ value }: { value: number }) {
  const size = 130;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const color = value >= 70 ? "#12B76A" : value >= 50 ? "#F79009" : "#F04438";
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash}, ${c}`}
          fill="none"
        />
      </G>
    </Svg>
  );
}

function Donut({ data }: { data: Record<string, number> }) {
  const size = 130;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = Object.values(data).reduce((s, v) => s + v, 0) || 1;
  let offset = 0;
  const arcs: any[] = [];
  Object.entries(data).forEach(([rating, count]) => {
    if (!count) return;
    const frac = count / total;
    const dash = frac * c;
    arcs.push(
      <Circle
        key={rating}
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={RATING_COLORS[rating]}
        strokeWidth={stroke}
        strokeDasharray={`${dash}, ${c - dash}`}
        strokeDashoffset={-offset}
        fill="none"
      />
    );
    offset += dash;
  });
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.borderLight} strokeWidth={stroke} fill="none" />
        {arcs}
      </G>
      <SvgText x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill={COLORS.textPrimary}>
        {total}
      </SvgText>
      <SvgText x={size / 2} y={size / 2 + 20} textAnchor="middle" fontSize="9" fill={COLORS.textMuted}>
        موظف
      </SvgText>
    </Svg>
  );
}

function TopBars({ data }: { data: Kpi[] }) {
  const w = Dimensions.get("window").width - 64;
  const barH = 24;
  const gap = 10;
  const h = data.length * (barH + gap) + 8;
  return (
    <Svg width={w} height={h}>
      {data.map((k, i) => {
        const barW = (k.kpi_score / 100) * (w - 100);
        const y = i * (barH + gap);
        const color = RATING_COLORS[k.rating];
        return (
          <G key={k.employee_id}>
            <Rect x={90} y={y} width={w - 100} height={barH} rx={6} fill={COLORS.borderLight} />
            <Rect x={90} y={y} width={barW} height={barH} rx={6} fill={color} />
            <SvgText x={80} y={y + barH / 2 + 4} textAnchor="end" fontSize="10" fill={COLORS.textPrimary}>
              {k.employee_name.length > 12 ? k.employee_name.slice(0, 12) + "…" : k.employee_name}
            </SvgText>
            <SvgText x={90 + barW - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize="10" fill="#fff" fontWeight="bold">
              {k.kpi_score}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  headerSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  gaugeInfo: { flex: 1 },
  gaugeLabel: { color: "#cbd5e1", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  gaugeValue: { color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  gaugeUnit: { color: "#cbd5e1", fontSize: 14, fontWeight: "400" },
  gaugeMeta: { flexDirection: "row", gap: 12, marginTop: 4 },
  gaugeMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  gaugeMetaText: { color: "#e2e8f0", fontSize: 11 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: "#0B3D91",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, color: COLORS.textSecondary, textAlign: "right", writingDirection: "rtl" },
  legendCount: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 6,
    marginBottom: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  empRow: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empName: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  ratingChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4 },
  ratingText: { fontSize: 10, fontWeight: "700" },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 999,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  miniStats: { flexDirection: "row", gap: 10, marginTop: 6 },
  miniStat: { fontSize: 10, color: COLORS.textSecondary },
  scoreBox: {
    alignItems: "center",
    padding: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    minWidth: 52,
  },
  scoreValue: { fontSize: 18, fontWeight: "900", color: COLORS.primary },
  scoreLabel: { fontSize: 9, color: COLORS.primary, fontWeight: "700" },
  empty: { alignItems: "center", padding: 40, gap: 10 },
});
