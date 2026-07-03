import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, STATUS_COLOR, STATUS_LABEL } from "@/src/theme";
import { buildRangeReportHtml, exportPdf, printHtml } from "@/src/reportExport";

type Dept = { id: string; name: string };

export default function RangeReport() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [fromDate, setFromDate] = useState(monthAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [deptId, setDeptId] = useState<string>("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === "general_manager") {
          setDepartments(await api.get<Dept[]>("/departments"));
        }
      } catch {}
    })();
  }, [user]);

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
      if (deptId) params.append("department_id", deptId);
      const res = await api.get<any>(`/reports/range?${params.toString()}`);
      setData(res);
    } catch (e: any) {
      setError(e.message || "فشل توليد التقرير");
    } finally {
      setLoading(false);
    }
  };

  const doExport = async () => {
    if (!data) return;
    const deptName = deptId ? (departments.find((d) => d.id === deptId)?.name || "") : "";
    await exportPdf(buildRangeReportHtml({ data, deptName }), "range-report");
  };
  const doPrint = async () => {
    if (!data) return;
    const deptName = deptId ? (departments.find((d) => d.id === deptId)?.name || "") : "";
    await printHtml(buildRangeReportHtml({ data, deptName }));
  };

  return (
    <View style={styles.container} testID="range-report-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>تقرير حسب فترة</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity testID="export-range" style={styles.iconAction} onPress={doExport} disabled={!data}>
              <Ionicons name="download-outline" size={16} color={data ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity testID="print-range" style={styles.iconAction} onPress={doPrint} disabled={!data}>
              <Ionicons name="print-outline" size={16} color={data ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.filterCard}>
          <Text style={styles.sectionTitle}>حدد الفترة الزمنية</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>من تاريخ</Text>
              <TextInput
                testID="input-from"
                style={styles.input}
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>إلى تاريخ</Text>
              <TextInput
                testID="input-to"
                style={styles.input}
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {user?.role === "general_manager" && (
            <>
              <Text style={styles.label}>القسم (اختياري — اتركه فارغاً لكل الشركة)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  testID="dept-all"
                  style={[styles.chip, !deptId && styles.chipActive]}
                  onPress={() => setDeptId("")}
                >
                  <Text style={[styles.chipText, !deptId && { color: "#fff" }]}>كل الشركة</Text>
                </TouchableOpacity>
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    testID={`dept-${d.id}`}
                    style={[styles.chip, deptId === d.id && styles.chipActive]}
                    onPress={() => setDeptId(d.id)}
                  >
                    <Text style={[styles.chipText, deptId === d.id && { color: "#fff" }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            testID="generate-btn"
            style={[styles.generateBtn, loading && { opacity: 0.7 }]}
            onPress={generate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="analytics" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>توليد التقرير</Text>
              </>
            )}
          </TouchableOpacity>
          {!!error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={14} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, fontSize: 12 }}>{error}</Text>
            </View>
          )}
        </View>

        {data && (
          <>
            <View style={styles.summary}>
              <StatCard label="إجمالي" value={data.count} color={COLORS.primary} icon="documents" />
              <StatCard label="معتمد" value={data.approved} color={COLORS.success} icon="checkmark-circle" />
              <StatCard label="بانتظار" value={data.pending} color={COLORS.warning} icon="time" />
              <StatCard label="مرفوض" value={data.rejected} color={COLORS.danger} icon="close-circle" />
            </View>

            {data.by_department?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>حسب الأقسام</Text>
                {data.by_department.map((d: any) => (
                  <View key={d.name} style={styles.deptRow} testID={`dept-row-${d.name}`}>
                    <Ionicons name="business" size={16} color={COLORS.primary} />
                    <Text style={styles.deptName}>{d.name}</Text>
                    <View style={styles.deptBadges}>
                      <View style={[styles.mini, { backgroundColor: COLORS.successBg }]}><Text style={[styles.miniText, { color: COLORS.success }]}>✓ {d.approved}</Text></View>
                      <View style={[styles.mini, { backgroundColor: COLORS.warningBg }]}><Text style={[styles.miniText, { color: COLORS.warning }]}>⏱ {d.pending}</Text></View>
                      <View style={[styles.mini, { backgroundColor: COLORS.dangerBg }]}><Text style={[styles.miniText, { color: COLORS.danger }]}>✗ {d.rejected}</Text></View>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>تفاصيل النشاطات ({data.activities?.length || 0})</Text>
            {(data.activities || []).slice(0, 100).map((a: any) => {
              const st = STATUS_COLOR[a.status] || { bg: COLORS.borderLight, fg: COLORS.textSecondary };
              return (
                <View key={a.id} style={styles.actCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actTitle} numberOfLines={2}>{a.activity_type}</Text>
                    <Text style={styles.actMeta}>{a.employee_department_name || "-"} • {a.activity_date}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.fg }]}>{STATUS_LABEL[a.status] || a.status}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color, icon }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary },
  actionRow: { flexDirection: "row", gap: 6 },
  iconAction: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.infoBg, alignItems: "center", justifyContent: "center" },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 10, marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  chip: {
    flexShrink: 0,
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  generateBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  errBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, padding: 8, backgroundColor: COLORS.dangerBg, borderRadius: 8 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 6,
  },
  deptName: { flex: 1, fontSize: 12, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  deptBadges: { flexDirection: "row", gap: 4 },
  mini: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  miniText: { fontSize: 10, fontWeight: "800" },
  actCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 6,
  },
  actTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  actMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: "700" },
});
