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
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS } from "@/src/theme";

type Dept = { id: string; name: string };
type Division = { id: string; name: string; department_id: string };

export default function DivisionsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Division | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, dv] = await Promise.all([api.get<Dept[]>("/departments"), api.get<Division[]>("/divisions")]);
      setDepartments(d);
      setDivisions(dv);
      if (!selectedDept && user?.department_id) setSelectedDept(user.department_id);
    } catch {}
  }, [user, selectedDept]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addDivision = async () => {
    setError("");
    if (!newName.trim() || !selectedDept) {
      setError("الرجاء إدخال اسم الشعبة واختيار القسم");
      return;
    }
    setSaving(true);
    try {
      await api.post("/divisions", { name: newName.trim(), department_id: selectedDept });
      setNewName("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name || "-";

  const openEdit = (dv: Division) => {
    setEditing(dv);
    setEditName(dv.name);
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
      await api.put(`/divisions/${editing.id}`, { name });
      setEditing(null);
      await load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="divisions-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>إدارة الشعب</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>إضافة شعبة جديدة</Text>

          {user?.role === "general_manager" && (
            <>
              <Text style={styles.label}>القسم</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    testID={`select-dept-${d.id}`}
                    style={[styles.chip, selectedDept === d.id && styles.chipActive]}
                    onPress={() => setSelectedDept(d.id)}
                  >
                    <Text style={[styles.chipText, selectedDept === d.id && { color: "#fff" }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.label}>اسم الشعبة</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="new-div-input"
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="اسم الشعبة"
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={addDivision}
            />
            <TouchableOpacity
              testID="add-div-btn"
              style={[styles.addBtn, saving && { opacity: 0.7 }]}
              onPress={addDivision}
              disabled={saving}
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

        <Text style={styles.listTitle}>الشعب ({divisions.length})</Text>
        {divisions.map((dv) => (
          <View key={dv.id} style={styles.row} testID={`div-item-${dv.id}`}>
            <Ionicons name="git-branch" size={20} color={COLORS.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{dv.name}</Text>
              <Text style={styles.rowSub}>{deptName(dv.department_id)}</Text>
            </View>
            <TouchableOpacity
              testID={`edit-div-${dv.id}`}
              onPress={() => openEdit(dv)}
              style={styles.editBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`delete-div-${dv.id}`}
              onPress={async () => {
                if (!confirm(`حذف شعبة "${dv.name}"؟`)) return;
                try {
                  await api.del(`/divisions/${dv.id}`);
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
        {divisions.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="git-branch-outline" size={54} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textMuted }}>لا توجد شعب بعد</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>تعديل اسم الشعبة</Text>
            <TextInput
              testID="edit-div-input"
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="اسم الشعبة"
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
                testID="save-edit-div"
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
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
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textAlign: "right",
    writingDirection: "rtl",
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
  row: {
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
  rowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  rowSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
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
