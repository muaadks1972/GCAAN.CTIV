import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, GRADIENTS, ROLE_LABEL } from "@/src/theme";

type Summary = { total: number; approved: number; rejected: number; pending: number; approval_rate: number };

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.get<Summary>("/reports/summary");
      setSummary(s);
      if (user && user.role !== "employee") {
        const list = await api.get<any[]>("/activities?scope=pending");
        setPendingCount(list.length);
      }
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

  if (!user) return null;

  const quickActions = getQuickActions(user.role);

  return (
    <View style={styles.container} testID="home-screen">
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>مرحباً</Text>
              <Text style={styles.name} testID="home-user-name">{user.full_name}</Text>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text>
              </View>
            </View>
            <Image
              source={require("../../assets/images/gcaan-logo.png")}
              style={styles.smallLogo}
              resizeMode="contain"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="إجمالي النشاطات"
            value={summary?.total ?? 0}
            icon="documents"
            color={COLORS.primary}
            testID="kpi-total"
          />
          <KpiCard
            label="المعتمدة"
            value={summary?.approved ?? 0}
            icon="checkmark-circle"
            color={COLORS.success}
            testID="kpi-approved"
          />
          <KpiCard
            label="بانتظار الاعتماد"
            value={summary?.pending ?? 0}
            icon="time"
            color={COLORS.warning}
            testID="kpi-pending"
          />
          <KpiCard
            label="نسبة الاعتماد"
            value={`${summary?.approval_rate ?? 0}%`}
            icon="trending-up"
            color={COLORS.secondary}
            testID="kpi-rate"
          />
        </View>

        {/* Pending Approvals Card (managers) */}
        {user.role !== "employee" && (
          <TouchableOpacity
            testID="pending-approvals-card"
            style={styles.pendingCard}
            onPress={() => router.push("/approvals")}
            activeOpacity={0.85}
          >
            <View style={styles.pendingIcon}>
              <Ionicons name="notifications" size={22} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>نشاطات بانتظار الموافقة</Text>
              <Text style={styles.pendingSubtitle}>{pendingCount} نشاط بحاجة لمراجعتك</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>الإجراءات السريعة</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              testID={`action-${a.key}`}
              style={styles.actionCard}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + "15" }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, icon, color, testID }: any) {
  return (
    <View style={styles.kpiCard} testID={testID}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function getQuickActions(role: string) {
  const common = [
    { key: "reports", label: "التقارير", icon: "stats-chart", color: COLORS.accent, route: "/(tabs)/reports" },
    { key: "range", label: "تقرير بفترة", icon: "calendar", color: COLORS.secondary, route: "/range-report" },
    { key: "kpi", label: "لوحة الأداء", icon: "trophy", color: COLORS.gold, route: "/kpi" },
  ];
  if (role === "employee") {
    return [
      { key: "new-activity", label: "إضافة نشاط", icon: "add-circle", color: COLORS.primary, route: "/activity-new" },
      { key: "my-activities", label: "نشاطاتي", icon: "list", color: COLORS.secondary, route: "/(tabs)/activities" },
      ...common,
    ];
  }
  if (role === "division_manager") {
    return [
      { key: "approvals", label: "الموافقات", icon: "checkmark-done-circle", color: COLORS.success, route: "/approvals" },
      { key: "users", label: "الموظفون", icon: "people", color: COLORS.primary, route: "/users" },
      { key: "new-activity", label: "إضافة نشاط", icon: "add-circle", color: COLORS.secondary, route: "/activity-new" },
      ...common,
    ];
  }
  if (role === "department_manager") {
    return [
      { key: "approvals", label: "الموافقات", icon: "checkmark-done-circle", color: COLORS.success, route: "/approvals" },
      { key: "dept-report", label: "تقرير القسم", icon: "clipboard", color: COLORS.info, route: "/dept-report" },
      { key: "employees-kpi", label: "KPI الموظفين", icon: "podium", color: COLORS.gold, route: "/kpi" },
      { key: "divisions", label: "الشعب", icon: "git-branch", color: COLORS.secondary, route: "/divisions" },
      { key: "users", label: "المدراء والموظفون", icon: "people", color: COLORS.primary, route: "/users" },
      ...common,
    ];
  }
  // general_manager
  return [
    { key: "approvals", label: "الموافقات النهائية", icon: "checkmark-done-circle", color: COLORS.success, route: "/approvals" },
    { key: "departments", label: "إدارة الأقسام", icon: "business", color: COLORS.primary, route: "/departments" },
    { key: "users", label: "المدراء", icon: "people", color: COLORS.secondary, route: "/users" },
    { key: "audit-log", label: "سجل التدقيق", icon: "shield-checkmark", color: COLORS.gold, route: "/audit-log" },
    { key: "system", label: "إدارة النظام", icon: "server", color: COLORS.warm, route: "/system" },
    ...common,
  ];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  hello: { color: "#cbd5e1", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  name: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  roleText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  smallLogo: { width: 56, height: 56, backgroundColor: "#fff", borderRadius: 12, padding: 6 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: -30,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  kpiLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FEF3C7",
    gap: 12,
    marginBottom: 20,
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  pendingSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "flex-end",
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
