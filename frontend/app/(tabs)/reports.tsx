import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { COLORS } from "@/src/theme";
import {
  buildByDepartmentHtml,
  buildComprehensiveHtml,
  buildCompletionHtml,
  buildPeriodReportHtml,
  downloadDocx,
  exportPdf,
  printHtml,
} from "@/src/reportExport";
import { storage } from "@/src/utils/storage";

type ByDept = {
  department_id: string;
  department_name: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approval_rate: number;
};

const TABS = [
  { key: "weekly", label: "أسبوعي", icon: "calendar-outline" as const },
  { key: "monthly", label: "شهري", icon: "calendar" as const },
  { key: "by-dept", label: "حسب الأقسام", icon: "business" as const },
  { key: "completion", label: "نسب الإنجاز", icon: "trending-up" as const },
  { key: "comprehensive", label: "تقرير شامل", icon: "document-text" as const },
];

export default function ReportsScreen() {
  const [tab, setTab] = useState("weekly");
  const [refreshing, setRefreshing] = useState(false);
  const [weekly, setWeekly] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [byDept, setByDept] = useState<ByDept[]>([]);
  const [completion, setCompletion] = useState<any[]>([]);
  const [comprehensive, setComprehensive] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [w, m, bd, c, comp] = await Promise.all([
        api.get("/reports/weekly"),
        api.get("/reports/monthly"),
        api.get<ByDept[]>("/reports/by-department"),
        api.get<any[]>("/reports/completion-rates"),
        api.get<any[]>("/reports/comprehensive"),
      ]);
      setWeekly(w);
      setMonthly(m);
      setByDept(bd);
      setCompletion(c);
      setComprehensive(comp);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const currentHtml = (): { html: string; name: string } | null => {
    if (tab === "weekly" && weekly) return { html: buildPeriodReportHtml(weekly, "التقرير الأسبوعي"), name: "weekly-report" };
    if (tab === "monthly" && monthly) return { html: buildPeriodReportHtml(monthly, "التقرير الشهري"), name: "monthly-report" };
    if (tab === "by-dept") return { html: buildByDepartmentHtml(byDept), name: "by-department-report" };
    if (tab === "completion") return { html: buildCompletionHtml(completion), name: "completion-report" };
    if (tab === "comprehensive") return { html: buildComprehensiveHtml(comprehensive), name: "comprehensive-report" };
    return null;
  };

  const onPrint = async () => {
    const c = currentHtml();
    if (c) await printHtml(c.html);
  };

  const onExport = async () => {
    const c = currentHtml();
    if (c) await exportPdf(c.html, c.name);
  };

  const onExportDocx = async () => {
    const token = await storage.secureGet("gcaan_token", "");
    if (!token) return;
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    await downloadDocx(`${base}/api/reports/comprehensive.docx`, token, "comprehensive-report.docx");
  };

  return (
    <View style={styles.container} testID="reports-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>التقارير</Text>
          <View style={styles.actionRow}>
            {tab === "comprehensive" && (
              <TouchableOpacity testID="export-docx-btn" style={[styles.actionBtn, { backgroundColor: COLORS.accent + "22" }]} onPress={onExportDocx} activeOpacity={0.85}>
                <Ionicons name="document-attach-outline" size={16} color={COLORS.accent} />
                <Text style={[styles.actionText, { color: COLORS.accent }]}>Word</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="export-btn" style={styles.actionBtn} onPress={onExport} activeOpacity={0.85}>
              <Ionicons name="download-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionText}>تصدير PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="print-btn" style={styles.actionBtn} onPress={onPrint} activeOpacity={0.85}>
              <Ionicons name="print-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionText}>طباعة</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              testID={`tab-${t.key}`}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={14} color={tab === t.key ? "#fff" : COLORS.textSecondary} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {tab === "weekly" && <PeriodReport data={weekly} title="التقرير الأسبوعي" />}
        {tab === "monthly" && <PeriodReport data={monthly} title="التقرير الشهري" />}
        {tab === "by-dept" && <ByDeptReport data={byDept} />}
        {tab === "completion" && <CompletionReport data={completion} />}
        {tab === "comprehensive" && <ComprehensiveReport data={comprehensive} />}
      </ScrollView>
    </View>
  );
}

function PeriodReport({ data, title }: { data: any; title: string }) {
  const activities = data?.activities || [];
  const approved = activities.filter((a: any) => a.status === "approved").length;
  const pending = activities.filter((a: any) => a.status?.startsWith("pending")).length;
  return (
    <View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <View style={styles.summaryRow}>
          <SummaryStat label="إجمالي" value={activities.length} color={COLORS.primary} />
          <SummaryStat label="معتمد" value={approved} color={COLORS.success} />
          <SummaryStat label="قيد المراجعة" value={pending} color={COLORS.warning} />
        </View>
      </View>
      {activities.length === 0 ? (
        <EmptyState />
      ) : (
        activities.map((a: any) => (
          <View key={a.id} style={styles.actRow} testID={`report-activity-${a.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actTitle} numberOfLines={2}>{a.activity_type}</Text>
              <Text style={styles.actMeta}>{a.employee_name} • {a.activity_date}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: a.status === "approved" ? COLORS.success : a.status === "rejected" ? COLORS.danger : COLORS.warning }]} />
          </View>
        ))
      )}
    </View>
  );
}

function ByDeptReport({ data }: { data: ByDept[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.department_id} style={styles.deptCard} testID={`dept-report-${d.department_id}`}>
          <View style={styles.deptHeader}>
            <View style={styles.deptIcon}>
              <Ionicons name="business" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.deptName} numberOfLines={1}>{d.department_name}</Text>
            <View style={styles.rateBadge}>
              <Text style={styles.rateText}>{d.approval_rate}%</Text>
            </View>
          </View>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${d.approval_rate}%` }]} />
          </View>
          <View style={styles.deptStats}>
            <StatMini icon="documents" label="إجمالي" value={d.total} />
            <StatMini icon="checkmark" label="معتمد" value={d.approved} color={COLORS.success} />
            <StatMini icon="time" label="بانتظار" value={d.pending} color={COLORS.warning} />
            <StatMini icon="close" label="مرفوض" value={d.rejected} color={COLORS.danger} />
          </View>
        </View>
      ))}
    </View>
  );
}

function CompletionReport({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <View style={{ gap: 10 }}>
      {data.map((e) => (
        <View key={e.employee_id} style={styles.empCard} testID={`emp-comp-${e.employee_id}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{e.employee_name}</Text>
            <Text style={styles.empMeta}>{e.approved} من {e.total} نشاط معتمد</Text>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${e.completion_rate}%` }]} />
            </View>
          </View>
          <Text style={styles.empRate}>{e.completion_rate}%</Text>
        </View>
      ))}
    </View>
  );
}

function ComprehensiveReport({ data }: { data: any[] }) {
  if (!data.length) return <EmptyState />;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>تقرير شامل بنشاطات الموظفين</Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: "right", writingDirection: "rtl", marginTop: 4 }}>
          يعرض كل موظف مع عدد نشاطاته، قسمه، والأقسام التي تم النشاط عليها
        </Text>
      </View>
      {data.map((r, idx) => (
        <View key={r.employee_id} style={styles.empCard} testID={`comp-emp-${r.employee_id}`}>
          <View style={styles.compRank}>
            <Text style={styles.compRankText}>{idx + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{r.employee_name}</Text>
            <View style={styles.compRow}>
              <Ionicons name="briefcase-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.compMeta}>القسم المنفّذ: {r.employee_department_name || "-"}</Text>
            </View>
            <View style={styles.compRow}>
              <Ionicons name="business-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.compMeta} numberOfLines={2}>
                القسم المستهدف: {r.targets.map((t: any) => `${t.name} (${t.count})`).join("، ") || "-"}
              </Text>
            </View>
          </View>
          <View style={styles.compCount}>
            <Text style={styles.compCountValue}>{r.total}</Text>
            <Text style={styles.compCountLabel}>نشاط</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SummaryStat({ label, value, color }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatMini({ icon, label, value, color = COLORS.primary }: any) {
  return (
    <View style={styles.statMini}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={styles.statMiniLabel}>{label}</Text>
      <Text style={[styles.statMiniValue, { color }]}>{value}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={54} color={COLORS.textMuted} />
      <Text style={{ color: COLORS.textMuted }}>لا توجد بيانات لعرضها</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
  actionRow: { flexDirection: "row", gap: 6 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  tabRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexDirection: "row" },
  tab: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  actRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  actMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  deptCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  deptHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  deptIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deptName: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  rateBadge: { backgroundColor: COLORS.successBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rateText: { color: COLORS.success, fontSize: 12, fontWeight: "800" },
  progress: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 999 },
  deptStats: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  statMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statMiniLabel: { fontSize: 11, color: COLORS.textSecondary },
  statMiniValue: { fontSize: 12, fontWeight: "800" },
  empCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  empName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  empMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  empRate: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  compRank: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  compRankText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  compRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  compMeta: { fontSize: 11, color: COLORS.textSecondary, flex: 1, textAlign: "right", writingDirection: "rtl" },
  compCount: {
    alignItems: "center",
    minWidth: 54,
    padding: 8,
    backgroundColor: COLORS.accentBg,
    borderRadius: 10,
  },
  compCountValue: { fontSize: 18, fontWeight: "900", color: COLORS.accent },
  compCountLabel: { fontSize: 9, color: COLORS.accent, fontWeight: "700" },
  empty: { alignItems: "center", padding: 40, gap: 10 },
});
