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
import { api } from "@/src/api";
import { COLORS } from "@/src/theme";

type Dept = { id: string; name: string };

export default function NewActivityScreen() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [activityType, setActivityType] = useState("");
  const [targetDept, setTargetDept] = useState<Dept | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<Dept[]>("/departments");
        setDepartments(d);
      } catch {}
    })();
  }, []);

  const submit = async () => {
    setError("");
    if (!activityDate || !activityType.trim()) {
      setError("الرجاء تعبئة تاريخ ونوع النشاط");
      return;
    }
    setSaving(true);
    try {
      await api.post("/activities", {
        activity_date: activityDate,
        activity_type: activityType.trim(),
        target_department_id: targetDept?.id,
        target_department_name: targetDept?.name,
        notes: notes.trim(),
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container} testID="new-activity-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={styles.iconBtn}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>إضافة نشاط جديد</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="تاريخ النشاط">
            <TextInput
              testID="input-date"
              style={styles.input}
              value={activityDate}
              onChangeText={setActivityDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
            />
          </Field>

          <Field label="نوع النشاط">
            <TextInput
              testID="input-type"
              style={styles.input}
              value={activityType}
              onChangeText={setActivityType}
              placeholder="مثال: اجتماع تنسيقي، صيانة نظام..."
              placeholderTextColor={COLORS.textMuted}
            />
          </Field>

          <Field label="القسم الذي تم عليه النشاط">
            <TouchableOpacity
              testID="dept-picker"
              style={styles.select}
              onPress={() => setShowDeptPicker((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              <Text style={[styles.selectText, !targetDept && { color: COLORS.textMuted }]}>
                {targetDept?.name || "اختر القسم"}
              </Text>
            </TouchableOpacity>
            {showDeptPicker && (
              <View style={styles.dropdown} testID="dept-dropdown">
                {departments.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    testID={`dept-option-${d.id}`}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setTargetDept(d);
                      setShowDeptPicker(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>{d.name}</Text>
                    {targetDept?.id === d.id && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
                {departments.length === 0 && (
                  <Text style={{ color: COLORS.textMuted, textAlign: "center", padding: 10 }}>لا توجد أقسام</Text>
                )}
              </View>
            )}
          </Field>

          <Field label="الملاحظات">
            <TextInput
              testID="input-notes"
              style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="أضف تفاصيل إضافية..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
          </Field>

          {!!error && (
            <View style={styles.errorBox} testID="new-activity-error">
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, flex: 1 }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="submit-activity"
            style={[styles.submitBtn, saving && { opacity: 0.7 }]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>حفظ النشاط</Text>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center", writingDirection: "rtl" },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
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
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  dropdownText: { fontSize: 14, color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
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
