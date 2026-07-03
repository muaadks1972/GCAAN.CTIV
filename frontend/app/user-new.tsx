import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { COLORS, ROLE_LABEL } from "@/src/theme";

export default function NewUserScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [divId, setDivId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Determine the role that this user will be creating
  const targetRole =
    user?.role === "general_manager"
      ? "department_manager"
      : user?.role === "department_manager"
      ? "division_manager"
      : "employee";

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<any[]>("/departments");
        setDepartments(d);
        if (user?.role === "department_manager" && user.department_id) {
          setDeptId(user.department_id);
          const dv = await api.get<any[]>(`/divisions?department_id=${user.department_id}`);
          setDivisions(dv);
        }
      } catch {}
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      if (user?.role === "general_manager" && deptId) {
        try {
          const dv = await api.get<any[]>(`/divisions?department_id=${deptId}`);
          setDivisions(dv);
        } catch {}
      }
    })();
  }, [deptId, user]);

  const submit = async () => {
    setError("");
    if (!fullName.trim() || !username.trim() || !password) {
      setError("الرجاء تعبئة جميع الحقول المطلوبة");
      return;
    }
    if (password.length < 4) {
      setError("كلمة المرور يجب أن تكون 4 أحرف فأكثر");
      return;
    }
    if (targetRole === "department_manager" && !deptId) {
      setError("الرجاء اختيار القسم");
      return;
    }
    if (targetRole === "division_manager" && !divId) {
      setError("الرجاء اختيار الشعبة");
      return;
    }

    setSaving(true);
    try {
      await api.post("/users", {
        full_name: fullName.trim(),
        username: username.trim(),
        password,
        role: targetRole,
        department_id: deptId,
        division_id: divId,
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "فشل الإنشاء");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="new-user-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>إضافة {ROLE_LABEL[targetRole]}</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="الاسم الكامل">
            <TextInput testID="input-fullname" style={styles.input} value={fullName} onChangeText={setFullName} placeholder="الاسم الرباعي" placeholderTextColor={COLORS.textMuted} />
          </Field>
          <Field label="اسم المستخدم">
            <TextInput testID="input-username" style={styles.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" />
          </Field>
          <Field label="كلمة المرور">
            <TextInput testID="input-password" style={styles.input} value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={COLORS.textMuted} secureTextEntry />
          </Field>

          {(targetRole === "department_manager" || targetRole === "division_manager") && user?.role === "general_manager" && (
            <Field label="القسم">
              <View style={styles.chipsRow}>
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    testID={`pick-dept-${d.id}`}
                    style={[styles.chip, deptId === d.id && styles.chipActive]}
                    onPress={() => { setDeptId(d.id); setDivId(null); }}
                  >
                    <Text style={[styles.chipText, deptId === d.id && { color: "#fff" }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          )}

          {targetRole === "division_manager" && (
            <Field label="الشعبة">
              <View style={styles.chipsRow}>
                {divisions.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    testID={`pick-div-${d.id}`}
                    style={[styles.chip, divId === d.id && styles.chipActive]}
                    onPress={() => setDivId(d.id)}
                  >
                    <Text style={[styles.chipText, divId === d.id && { color: "#fff" }]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
                {divisions.length === 0 && (
                  <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>لا توجد شعب — قم بإنشاء شعبة أولاً</Text>
                )}
              </View>
            </Field>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, flex: 1 }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="submit-user"
            style={[styles.submitBtn, saving && { opacity: 0.7 }]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.submitText}>حفظ</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center" },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
