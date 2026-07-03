import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, STATUS_COLOR, STATUS_LABEL } from "@/src/theme";

type Activity = {
  id: string;
  employee_name: string;
  employee_department_name?: string;
  activity_date: string;
  activity_type: string;
  target_department_name?: string;
  notes?: string;
  status: string;
  created_at: string;
};

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending_division", label: "بانتظار الشعبة" },
  { key: "pending_department", label: "بانتظار القسم" },
  { key: "pending_gm", label: "بانتظار مكتب المدير العام" },
  { key: "approved", label: "معتمد" },
  { key: "rejected", label: "مرفوض" },
];

export default function ActivitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const list = await api.get<Activity[]>(`/activities${q}`);
      setItems(list);
    } catch {}
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container} testID="activities-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>النشاطات</Text>
          {user && (user.role === "employee" || user.role === "division_manager" || user.role === "department_manager") && (
            <TouchableOpacity
              testID="add-activity-btn"
              style={styles.addBtn}
              onPress={() => router.push("/activity-new")}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>إضافة نشاط</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              testID={`filter-${f.key}`}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="empty-activities">
            <Ionicons name="document-text-outline" size={54} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>لا توجد نشاطات</Text>
          </View>
        }
        renderItem={({ item }) => <ActivityCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

function ActivityCard({ item }: { item: Activity }) {
  const st = STATUS_COLOR[item.status] || { bg: COLORS.borderLight, fg: COLORS.textSecondary };
  return (
    <View style={styles.card} testID={`activity-card-${item.id}`}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.fg }]}>{STATUS_LABEL[item.status] || item.status}</Text>
        </View>
        <Text style={styles.date}>{item.activity_date}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.activity_type}</Text>
      {!!item.employee_department_name && (
        <View style={styles.metaRow}>
          <Ionicons name="briefcase-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>القسم المنفّذ: {item.employee_department_name}</Text>
        </View>
      )}
      {!!item.target_department_name && (
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>القسم المستهدف: {item.target_department_name}</Text>
        </View>
      )}
      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
        <Text style={styles.metaText}>{item.employee_name}</Text>
      </View>
      {!!item.notes && <Text style={styles.notes} numberOfLines={3}>{item.notes}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexDirection: "row" },
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
  chipTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 12, color: COLORS.textMuted },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary, textAlign: "right", writingDirection: "rtl" },
  notes: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },
  empty: { alignItems: "center", padding: 40, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
