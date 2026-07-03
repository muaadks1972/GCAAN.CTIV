import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, STATUS_COLOR, STATUS_LABEL } from "@/src/theme";

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | "edit" | null>(null);
  const [reason, setReason] = useState("");
  const [editType, setEditType] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.get<any[]>("/activities?scope=pending");
      setItems(list);
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

  const openAction = (act: any, mode: "approve" | "reject" | "edit") => {
    setSelected(act);
    setModalMode(mode);
    setReason("");
    setEditType(act.activity_type || "");
    setEditNotes(act.notes || "");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setReason("");
  };

  const doAction = async () => {
    if (!selected || !modalMode) return;
    setSaving(true);
    try {
      const body: any = { action: modalMode };
      if (modalMode === "reject") body.reason = reason;
      if (modalMode === "edit") {
        body.activity_type = editType;
        body.notes = editNotes;
      }
      await api.post(`/activities/${selected.id}/action`, body);
      closeModal();
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container} testID="approvals-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>الموافقات ({items.length})</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={COLORS.success} />
            <Text style={styles.emptyTitle}>لا توجد نشاطات بحاجة لموافقتك</Text>
            <Text style={styles.emptyText}>جميع النشاطات مراجعة حالياً</Text>
          </View>
        ) : (
          items.map((a) => {
            const st = STATUS_COLOR[a.status];
            return (
              <View key={a.id} style={styles.card} testID={`approval-card-${a.id}`}>
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.fg }]}>{STATUS_LABEL[a.status]}</Text>
                  </View>
                  <Text style={styles.date}>{a.activity_date}</Text>
                </View>
                <Text style={styles.cardTitle}>{a.activity_type}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.metaText}>{a.employee_name}</Text>
                </View>
                {!!a.target_department_name && (
                  <View style={styles.metaRow}>
                    <Ionicons name="business-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.metaText}>{a.target_department_name}</Text>
                  </View>
                )}
                {!!a.notes && <Text style={styles.notes}>{a.notes}</Text>}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    testID={`approve-${a.id}`}
                    style={[styles.actBtn, { backgroundColor: COLORS.success }]}
                    onPress={() => openAction(a, "approve")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.actText}>موافقة</Text>
                  </TouchableOpacity>
                  {user.role === "department_manager" && (
                    <TouchableOpacity
                      testID={`edit-${a.id}`}
                      style={[styles.actBtn, { backgroundColor: COLORS.warning }]}
                      onPress={() => openAction(a, "edit")}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={styles.actText}>تعديل</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    testID={`reject-${a.id}`}
                    style={[styles.actBtn, { backgroundColor: COLORS.danger }]}
                    onPress={() => openAction(a, "reject")}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.actText}>رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!modalMode} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalMode === "approve" ? "تأكيد الموافقة" : modalMode === "reject" ? "رفض النشاط" : "تعديل النشاط"}
            </Text>
            {modalMode === "reject" && (
              <TextInput
                testID="reject-reason-input"
                style={styles.modalInput}
                value={reason}
                onChangeText={setReason}
                placeholder="سبب الرفض"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            )}
            {modalMode === "edit" && (
              <>
                <Text style={styles.modalLabel}>نوع النشاط</Text>
                <TextInput
                  testID="edit-type-input"
                  style={styles.modalInput}
                  value={editType}
                  onChangeText={setEditType}
                />
                <Text style={styles.modalLabel}>الملاحظات</Text>
                <TextInput
                  testID="edit-notes-input"
                  style={[styles.modalInput, { minHeight: 80 }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.borderLight }]} onPress={closeModal}>
                <Text style={{ color: COLORS.textPrimary, fontWeight: "700" }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-action"
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={doAction}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>تأكيد</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
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
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", padding: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, textAlign: "center" },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
    minHeight: 44,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
