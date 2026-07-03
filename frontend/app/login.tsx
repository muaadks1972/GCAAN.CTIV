import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { COLORS, GRADIENTS } from "@/src/theme";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const passRef = useRef<TextInput>(null);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={GRADIENTS.primary}
      style={styles.gradient}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.logoBox}>
                <Image
                  source={require("../assets/images/gcaan-logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>الشركة العامة لإدارة المطارات</Text>
              <Text style={styles.subtitle}>والملاحة الجوية</Text>
              <Text style={styles.tagline}>نظام إدارة أنشطة الموظفين</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>تسجيل الدخول</Text>

              <View style={styles.field}>
                <Text style={styles.label}>اسم المستخدم</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
                  <TextInput
                    testID="login-username-input"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="أدخل اسم المستخدم"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>كلمة المرور</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
                  <TextInput
                    ref={passRef}
                    testID="login-password-input"
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="أدخل كلمة المرور"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPass}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPass((v) => !v)} testID="toggle-password">
                    <Ionicons
                      name={showPass ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox} testID="login-error">
                  <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="login-submit-button"
                style={[styles.button, loading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>دخول</Text>
                    <Ionicons name="log-in-outline" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.hint} testID="default-credentials-hint">
                افتراضي: admin / admin123
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>تصميم المهندس معاد كاظم</Text>
              <Text style={styles.footerSmall}>GCAAN © 2026</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logo: { width: 90, height: 90 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  subtitle: { color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center", writingDirection: "rtl" },
  tagline: { color: "#cbd5e1", fontSize: 13, marginTop: 8, textAlign: "center", writingDirection: "rtl" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: "right",
    writingDirection: "rtl",
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
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
    marginBottom: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 13, flex: 1, textAlign: "right", writingDirection: "rtl" },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    writingDirection: "rtl",
  },
  footer: { alignItems: "center", marginTop: 24 },
  footerText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  footerSmall: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
});
