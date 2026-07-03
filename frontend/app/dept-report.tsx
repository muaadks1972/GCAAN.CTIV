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
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, STATUS_COLOR, STATUS_LABEL } from "@/src/theme";
import { buildDepartmentReportHtml, buildEmployeesActivitiesHtml, exportPdf, printHtml } from "@/src/reportExport";

type Dept = { id: string; name: string };
type Summary = { total: number; approved: number; rejected: number; pending: number; approval_rate: number };

export default function DeptReportScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [deptName, setDeptName] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [depts, s, acts, comp] = await Promise.all([
        api.get<Dept[]>("/departments"),
        api.get<Summary>("/reports/summary"),
        api.get<any[]>("/activities"),
        api.get<any[]>("/reports/completion-rates"),
      ]);
      const my = depts.find((d) => d.id === user?.department_id);
      setDeptName(my?.name || "قسمي");
      setSummary(s);
      setActivities(acts);
      setEmployees(comp);
    } catch {}
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const buildHtml = () =>
    buildDepartmentReportHtml({
      deptName,
      summary: summary || { total: 0, approved: 0, rejected: 0, pending: 0 },
      activities,
      employees,
    });

  return (
    <View style={styles.container} testID="dept-report-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>تقرير القسم</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              testID="export-dept-report"
              style={styles.actionBtn}
              onPress={() => exportPdf(buildHtml(), "department-report")}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="print-dept-report"
              style={styles.actionBtn}
              onPress={() => printHtml(buildHtml())}
              activeOpacity={0.85}
            >
              <Ionicons name="print-outline" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Dept name banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="business" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerLabel}>القسم</Text>
            <Text style={styles.bannerName} testID="dept-name">{deptName}</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <SummaryCard label="إجمالي" value={summary?.total ?? 0} color={COLORS.primary} icon="documents" />
          <SummaryCard label="معتمد" value={summary?.approved ?? 0} color={COLORS.success} icon="checkmark-circle" />
          <SummaryCard label="قيد المراجعة" value={summary?.pending ?? 0} color={COLORS.warning} icon="time" />
          <SummaryCard label="مرفوض" value={summary?.rejected ?? 0} color={COLORS.danger} icon="close-circle" />
        </View>

        {/* Employees performance */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>أداء العاملين في القسم</Text>
          <TouchableOpacity
            testID="export-emp-activities"
            style={styles.expBtn}
            onPress={() =>
              exportPdf(
                buildEmployeesActivitiesHtml({ deptName, employees, activities }),
                "employees-activities-report"
              )
            }
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={14} color="#fff" />
            <Text style={styles.expBtnText}>تصدير تقرير الموظفين</Text>
          </TouchableOpacity>
        </View>
        {employees.length === 0 ? (
          <EmptyState text="لا يوجد موظفون في القسم" />
        ) : (
          employees.map((e) => (
            <View key={e.employee_id} style={styles.empCard} testID={`emp-row-${e.employee_id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{e.employee_name}</Text>
                <Text style={styles.empMeta}>{e.approved} من {e.total} نشاط معتمد</Text>
                <View style={styles.progress}>
                  <View style={[styles.progressFill, { width: `${e.completion_rate}%` }]} />
                </View>
              </View>
              <Text style={styles.empRate}>{e.completion_rate}%</Text>
            </View>
          ))
        )}

        {/* Activities */}
        <Text style={styles.sectionTitle}>نشاطات القسم ({activities.length})</Text>
        {activities.length === 0 ? (
          <EmptyState text="لا توجد نشاطات" />
        ) : (
          activities.slice(0, 30).map((a) => {
            const st = STATUS_COLOR[a.status] || { bg: COLORS.borderLight, fg: COLORS.textSecondary };
            return (
              <View key={a.id} style={styles.actCard} testID={`act-row-${a.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actTitle} numberOfLines={2}>{a.activity_type}</Text>
                  <Text style={styles.actMeta}>{a.activity_date}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.fg }]}>{STATUS_LABEL[a.status] || a.status}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, color, icon }: any) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="bar-chart-outline" size={40} color={COLORS.textMuted} />
      <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary, flex: 1, textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerLabel: { color: "#cbd5e1", fontSize: 12 },
  bannerName: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardValue: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  cardLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 6,
    marginBottom: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  expBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  expBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  empName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  empMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  empRate: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  progress: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.primary, borderRadius: 999 },
  actCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  actTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  actMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  empty: { alignItems: "center", padding: 30, gap: 8 },
});
