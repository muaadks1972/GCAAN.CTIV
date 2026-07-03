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
import { COLORS, ROLE_LABEL } from "@/src/theme";

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  role: string;
  department_id?: string | null;
  division_id?: string | null;
};

export default function UsersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await api.get<UserRow[]>("/users");
      setUsers(list);
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

  const canEdit = (target: UserRow) => {
    if (!user) return false;
    if (target.id === user.id) return true;
    if (user.role === "general_manager" && target.role === "department_manager") return true;
    if (
      user.role === "department_manager" &&
      target.department_id === user.department_id &&
      (target.role === "division_manager" || target.role === "employee")
    )
      return true;
    if (user.role === "division_manager" && target.division_id === user.division_id && target.role === "employee")
      return true;
    return false;
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditName(u.full_name);
    setEditPassword("");
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body: any = {};
    if (editName.trim() && editName.trim() !== editing.full_name) body.full_name = editName.trim();
    if (editPassword) {
      if (editPassword.length < 4) {
        setEditError("كلمة المرور يجب أن تكون 4 أحرف فأكثر");
        return;
      }
      body.password = editPassword;
    }
    if (Object.keys(body).length === 0) {
      setEditError("لا توجد تغييرات لحفظها");
      return;
    }
    setEditSaving(true);
    try {
      await api.put(`/users/${editing.id}`, body);
      setEditing(null);
      await load();
    } catch (e: any) {
      setEditError(e.message || "فشل الحفظ");
    } finally {
      setEditSaving(false);
    }
  };

  const canCreate = user && user.role !== "employee";
  const roleTitle =
    user?.role === "general_manager"
      ? "مديري الأقسام"
      : user?.role === "department_manager"
      ? "مديري الشعب والموظفون"
      : user?.role === "division_manager"
      ? "الموظفون"
      : "المستخدمون";

  return (
    <View style={styles.container} testID="users-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{roleTitle}</Text>
          {canCreate ? (
            <TouchableOpacity
              testID="add-user-btn"
              style={styles.addBtn}
              onPress={() => router.push("/user-new")}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {users.map((u) => (
          <View key={u.id} style={styles.userCard} testID={`user-${u.id}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(u.full_name || u.username || "?").charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.full_name}</Text>
              <Text style={styles.userMeta}>@{u.username}</Text>
            </View>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{ROLE_LABEL[u.role]}</Text>
            </View>
            {canEdit(u) && (
              <>
                <TouchableOpacity
                  testID={`edit-user-${u.id}`}
                  onPress={() => openEdit(u)}
                  style={styles.editBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {u.id !== user?.id && (
                  <TouchableOpacity
                    testID={`delete-user-${u.id}`}
                    onPress={async () => {
                      if (!confirm(`حذف حساب "${u.full_name}"؟`)) return;
                      try {
                        await api.del(`/users/${u.id}`);
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
                )}
              </>
            )}
          </View>
        ))}
        {users.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={54} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textMuted }}>لا يوجد مستخدمون بعد</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>تعديل بيانات المستخدم</Text>
            <Text style={styles.modalHint}>
              اترك حقل كلمة المرور فارغاً إذا لم ترد تغييرها
            </Text>

            <Text style={styles.modalLabel}>الاسم الكامل</Text>
            <TextInput
              testID="edit-user-name"
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="الاسم الكامل"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.modalLabel}>كلمة مرور جديدة</Text>
            <TextInput
              testID="edit-user-password"
              style={styles.modalInput}
              value={editPassword}
              onChangeText={setEditPassword}
              placeholder="اتركها فارغة إذا لم ترد تغييرها"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
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
                testID="save-user-edit"
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  userCard: {
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  userName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  userMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  roleTag: { backgroundColor: COLORS.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleTagText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
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
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  modalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8, marginBottom: 4, textAlign: "right", writingDirection: "rtl" },
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
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
