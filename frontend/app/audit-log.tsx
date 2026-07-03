import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { COLORS, GRADIENTS } from "@/src/theme";

type AuditLog = {
  id: string;
  at: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: any;
  status: string;
};

type Summary = {
  total: number;
  last_24h: number;
  failed_logins_24h: number;
  by_action: { action: string; count: number }[];
};

const ACTION_LABEL: Record<string, string> = {
  login: "تسجيل دخول",
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  reject: "رفض",
  edit: "تعديل نشاط",
  backup: "نسخ احتياطي",
  restore: "استعادة",
};

const ENTITY_LABEL: Record<string, string> = {
  auth: "المصادقة",
  user: "مستخدم",
  department: "قسم",
  division: "شعبة",
  activity: "نشاط",
  system: "النظام",
};

const ACTION_ICON: Record<string, any> = {
  login: "log-in",
  create: "add-circle",
  update: "create",
  delete: "trash",
  approve: "checkmark-circle",
  reject: "close-circle",
  edit: "pencil",
  backup: "cloud-download",
  restore: "cloud-upload",
};

const ACTION_COLOR: Record<string, string> = {
  login: COLORS.info,
  create: COLORS.success,
  update: COLORS.secondary,
  delete: COLORS.danger,
  approve: COLORS.success,
  reject: COLORS.danger,
  edit: COLORS.warning,
  backup: COLORS.accent,
  restore: COLORS.warm,
};

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "الكل" },
  { key: "login", label: "دخول" },
  { key: "create", label: "إنشاء" },
  { key: "update", label: "تعديل" },
  { key: "delete", label: "حذف" },
  { key: "approve", label: "اعتماد" },
  { key: "reject", label: "رفض" },
  { key: "backup", label: "نسخ" },
];

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "الآن";
    if (min < 60) return `قبل ${min} د`;
    const h = Math.floor(min / 60);
    if (h < 24) return `قبل ${h} س`;
    const days = Math.floor(h / 24);
    if (days < 7) return `قبل ${days} يوم`;
    return d.toLocaleDateString("ar-IQ");
  } catch {
    return iso;
  }
}

export default function AuditLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = filter ? `?action=${filter}&limit=500` : `?limit=500`;
      const [logsRes, sumRes] = await Promise.all([
        api.get<{ logs: AuditLog[]; total: number }>(`/admin/audit-logs${params}`),
        api.get<Summary>(`/admin/audit-logs/summary`),
      ]);
      setLogs(logsRes.logs || []);
      setSummary(sumRes);
    } catch (e: any) {
      setError(e.message || "فشل تحميل السجل");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    const byDay: Record<string, AuditLog[]> = {};
    for (const l of logs) {
      const day = (l.at || "").slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(l);
    }
    return Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [logs]);

  return (
    <View style={styles.container} testID="audit-log-screen">
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>سجل التدقيق</Text>
              <Text style={styles.headerSub}>Audit Log</Text>
            </View>
            <Ionicons name="shield-checkmark" size={26} color="#fff" />
          </View>

          {summary && (
            <View style={styles.statsRow}>
              <StatChip label="إجمالي" value={summary.total} />
              <StatChip label="آخر 24 ساعة" value={summary.last_24h} />
              <StatChip
                label="محاولات دخول فاشلة"
                value={summary.failed_logins_24h}
                danger={summary.failed_logins_24h > 0}
              />
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          {ACTION_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              testID={`filter-${f.key || "all"}`}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={[styles.msg, { backgroundColor: COLORS.dangerBg }]}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
            <Text style={{ color: COLORS.danger, flex: 1, fontSize: 12 }}>{error}</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>لا توجد سجلات لعرضها</Text>
          </View>
        ) : (
          grouped.map(([day, items]) => (
            <View key={day} style={{ marginBottom: 16 }}>
              <Text style={styles.dayHeader}>{day}</Text>
              {items.map((l) => (
                <LogRow key={l.id} log={l} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatChip({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={[styles.stat, danger && { backgroundColor: "rgba(240,68,56,0.20)" }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const color = ACTION_COLOR[log.action] || COLORS.textMuted;
  const iconName = ACTION_ICON[log.action] || "ellipse";
  const isFailed = log.status === "failed";
  const detailsText = log.details ? formatDetails(log.details) : "";
  return (
    <View style={styles.row} testID={`log-${log.id}`}>
      <View style={[styles.rowIcon, { backgroundColor: (isFailed ? COLORS.danger : color) + "18" }]}>
        <Ionicons name={isFailed ? "alert-circle" : iconName} size={20} color={isFailed ? COLORS.danger : color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {ACTION_LABEL[log.action] || log.action}
            {" · "}
            {ENTITY_LABEL[log.entity_type] || log.entity_type}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(log.at)}</Text>
        </View>
        <Text style={styles.rowUser} numberOfLines={1}>
          {log.user_name || "غير معروف"}
          {isFailed ? " (فشل)" : ""}
        </Text>
        {!!detailsText && (
          <Text style={styles.rowDetails} numberOfLines={2}>{detailsText}</Text>
        )}
      </View>
    </View>
  );
}

function formatDetails(d: any): string {
  if (!d || typeof d !== "object") return "";
  const parts: string[] = [];
  if (d.name) parts.push(`الاسم: ${d.name}`);
  if (d.username) parts.push(`المستخدم: ${d.username}`);
  if (d.full_name) parts.push(`${d.full_name}`);
  if (d.role) parts.push(`دور: ${d.role}`);
  if (d.activity_type) parts.push(`نوع: ${d.activity_type}`);
  if (d.target_department) parts.push(`إلى: ${d.target_department}`);
  if (d.new_status) parts.push(`الحالة: ${d.new_status}`);
  if (d.reason) parts.push(`سبب: ${d.reason}`);
  if (d.employee_name) parts.push(`الموظف: ${d.employee_name}`);
  if (d.filename) parts.push(`ملف: ${d.filename}`);
  if (d.fields && Array.isArray(d.fields)) parts.push(`الحقول: ${d.fields.join(", ")}`);
  if (d.restored && typeof d.restored === "object") {
    const totals = Object.entries(d.restored).map(([k, v]) => `${k}:${v}`).join(", ");
    parts.push(`المُستعاد: ${totals}`);
  }
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  headerSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 14 },
  stat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#e2e8f0", fontSize: 10, marginTop: 4, textAlign: "center" },
  filterBar: {
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.borderLight,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  msg: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  dayHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  rowTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowTime: { fontSize: 10, color: COLORS.textMuted },
  rowUser: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  rowDetails: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
});
