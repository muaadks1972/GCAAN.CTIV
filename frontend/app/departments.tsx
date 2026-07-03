import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { COLORS } from "@/src/theme";

type Dept = { id: string; name: string; created_at?: string };

export default function DepartmentsScreen() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api.get<Dept[]>("/departments");
      setDepartments(list);
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

  const addDepartment = async () => {
    setError("");
    const name = newName.trim();
    if (!name) {
      setError("الرجاء إدخال اسم القسم");
      return;
    }
    setSaving(true);
    try {
      await api.post("/departments", { name });
      setNewName("");
      await load();
    } catch (e: any) {
      setError(e.message || "فشل الإضافة");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (d: Dept) => {
    setEditing(d);
    setEditName(d.name);
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editName.trim();
    if (!name) {
      setEditError("الاسم لا يمكن أن يكون فارغاً");
      return;
    }
    setEditSaving(true);
    try {
      await api.put(`/departments/${editing.id}`, { name });
      setEditing(null);
      await load();
    } catch (e: any) {
      setEditError(e.message || "فشل التعديل");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="departments-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>إدارة الأقسام</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>إضافة قسم جديد</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="new-dept-input"
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="اسم القسم (مثال: قسم الأمن)"
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={addDepartment}
              returnKeyType="done"
            />
            <TouchableOpacity
              testID="add-dept-btn"
              style={[styles.addBtn, saving && { opacity: 0.7 }]}
              onPress={addDepartment}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="add" size={22} color="#fff" />}
            </TouchableOpacity>
          </View>
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, flex: 1 }}>{error}</Text>
            </View>
          )}
        </View>

        <Text style={styles.listTitle}>الأقسام الحالية ({departments.length})</Text>
        {departments.map((d, idx) => (
          <View key={d.id} style={styles.deptRow} testID={`dept-item-${d.id}`}>
            <View style={styles.deptIndex}>
              <Text style={styles.deptIndexText}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deptName}>{d.name}</Text>
              <Text style={styles.deptSub}>معرف: {d.id.slice(0, 8)}</Text>
            </View>
            <TouchableOpacity
              testID={`edit-dept-${d.id}`}
              onPress={() => openEdit(d)}
              style={styles.editBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`delete-dept-${d.id}`}
              onPress={async () => {
                if (!confirm(`حذف قسم "${d.name}"؟`)) return;
                try {
                  await api.del(`/departments/${d.id}`);
                  await load();
                } catch (e: any) {
                  alert(e.message || "فشل الحذف");
                }
              }}
              style={[styles.editBtn, { backgroundColor: COLORS.dangerBg }]}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}
        {departments.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={54} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textMuted }}>لا توجد أقسام بعد</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>تعديل اسم القسم</Text>
            <TextInput
              testID="edit-dept-input"
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="اسم القسم"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            {!!editError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={{ color: COLORS.danger, flex: 1 }}>{editError}</Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.borderLight }]}
                onPress={() => setEditing(null)}
              >
                <Text style={{ color: COLORS.textPrimary, fontWeight: "700" }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="save-edit-dept"
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>حفظ</Text>
                )}
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
  addCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
  addBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  deptIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deptIndexText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  deptName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  deptSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", padding: 40, gap: 10 },
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
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
