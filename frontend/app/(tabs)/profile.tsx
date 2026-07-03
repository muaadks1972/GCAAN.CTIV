import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { COLORS, ROLE_LABEL } from "@/src/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (!user) return null;

  return (
    <View style={styles.container} testID="profile-screen">
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Text style={styles.title}>الملف الشخصي</Text>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <Text style={styles.name} testID="profile-name">{user.full_name}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
            <Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <InfoRow icon="id-card-outline" label="اسم المستخدم" value={user.username} />
          <InfoRow icon="briefcase-outline" label="الصلاحية" value={ROLE_LABEL[user.role]} />
        </View>

        <TouchableOpacity
          testID="privacy-link"
          style={styles.privacyBtn}
          onPress={() => router.push("/privacy")}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-half-outline" size={20} color={COLORS.primary} />
          <Text style={styles.privacyText}>سياسة الخصوصية</Text>
          <Ionicons name="chevron-back" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="logout-button"
          style={styles.logoutBtn}
          onPress={onLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Image source={require("../../assets/images/gcaan-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.footerText}>تصميم المهندس معاد كاظم</Text>
          <Text style={styles.footerSmall}>GCAAN © 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center" },
  username: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  roleText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: "right", writingDirection: "rtl" },
  rowValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "600", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 14,
    borderRadius: 14,
  },
  logoutText: { color: COLORS.danger, fontSize: 15, fontWeight: "700" },
  privacyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  privacyText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  footer: { alignItems: "center", marginTop: 30, gap: 6 },
  logo: { width: 60, height: 60, opacity: 0.7 },
  footerText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 4 },
  footerSmall: { color: COLORS.textMuted, fontSize: 11 },
});
