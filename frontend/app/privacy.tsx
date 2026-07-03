import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, GRADIENTS } from "@/src/theme";

const SECTIONS: { title: string; body: string; icon: any }[] = [
  {
    icon: "information-circle",
    title: "١. مقدمة",
    body: "يوضّح هذا المستند سياسة الخصوصية الخاصة بتطبيق «نشاطات الشركة العامة للمطارات والملاحة الجوية (GCAAN)». يُعتبر استخدامك للتطبيق موافقةً على البنود الواردة أدناه. جميع بيانات المستخدمين مملوكة للشركة العامة للمطارات والملاحة الجوية العراقية.",
  },
  {
    icon: "person-circle",
    title: "٢. البيانات التي نجمعها",
    body: "نجمع البيانات المرتبطة ببيئة العمل الوظيفي حصراً وتشمل: الاسم الرباعي، اسم المستخدم، الصلاحية الوظيفية، القسم والشعبة، والنشاطات المُدخَلة من قِبَل الموظفين ومسار اعتمادها. لا نجمع بيانات صحية أو موقعاً جغرافياً أو أي معلومات شخصية غير متعلقة بالعمل.",
  },
  {
    icon: "lock-closed",
    title: "٣. تشفير كلمات المرور",
    body: "تُشفَّر كلمات مرور جميع المستخدمين باستخدام خوارزمية Bcrypt أحادية الاتجاه. لا يمكن لأي شخص، بما في ذلك مطوّر النظام أو المدير العام، الاطلاع على كلمة المرور الأصلية.",
  },
  {
    icon: "shield-checkmark",
    title: "٤. الصلاحيات (RBAC)",
    body: "يعتمد النظام على نموذج التحكم بالوصول القائم على الأدوار (Role-Based Access Control). كل مستخدم يرى ويعدّل فقط ما يخصّ نطاقه الوظيفي: الموظف نشاطاته فقط، مدير الشعبة نشاطات شعبته، مدير القسم نشاطات قسمه، والمدير العام كل النشاطات.",
  },
  {
    icon: "server",
    title: "٥. تخزين البيانات",
    body: "تُخزّن جميع البيانات في قاعدة بيانات MongoDB المستضافة ضمن البنية التحتية للمنظمة. لا تتم مشاركة أي بيانات مع أطراف خارجية. يمكن للمدير العام تنزيل نسخة احتياطية كاملة (JSON) واستعادتها في أي وقت.",
  },
  {
    icon: "document-lock",
    title: "٦. سجل التدقيق",
    body: "يحتفظ النظام بسجلّ تدقيق (Audit Log) لكل العمليات الحسّاسة (تسجيل الدخول، إنشاء/تعديل/حذف المستخدمين، اعتماد/رفض النشاطات، النسخ الاحتياطي والاستعادة). يمكن للمدير العام مراجعة هذا السجل في أي وقت لضمان الشفافية والمساءلة.",
  },
  {
    icon: "eye-off",
    title: "٧. من يستطيع رؤية بياناتك",
    body: "لا يستطيع أي مستخدم مشاهدة بيانات مستخدم آخر خارج التسلسل الوظيفي. لا يوجد وصول عمومي، وجميع الطلبات إلى الخادم محميّة بمصادقة JWT مع صلاحية 7 أيام.",
  },
  {
    icon: "trash-bin",
    title: "٨. حذف البيانات",
    body: "يمكن للمدير العام حذف أي مستخدم أو قسم بشرط استيفاء الشروط (كعدم وجود شعب أو مستخدمين تابعين). كما يستطيع كل موظف حذف نشاطاته المرفوضة أو التي لم تُعتَمَد بعد.",
  },
  {
    icon: "notifications-off",
    title: "٩. الإشعارات والاتصالات",
    body: "لا يرسل التطبيق أي رسائل بريدية أو نصية أو إشعارات دفع خارج بيئة العمل. جميع التنبيهات تُعرض داخل الواجهة فقط.",
  },
  {
    icon: "sync-circle",
    title: "١٠. تحديث السياسة",
    body: "قد يتم تحديث هذه السياسة بموجب أوامر إدارية داخلية. سيُبلَّغ المدراء بأي تعديل جوهري عبر النظام أو المراسلات الرسمية.",
  },
  {
    icon: "call",
    title: "١١. التواصل",
    body: "لأي استفسار أو بلاغ يتعلق بالخصوصية أو الأمان، يُرجى مراجعة الجهة الإدارية المختصة داخل الشركة العامة للمطارات والملاحة الجوية.\n\nتصميم وتطوير: المهندس معاد كاظم.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <View style={styles.container} testID="privacy-screen">
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>سياسة الخصوصية</Text>
              <Text style={styles.headerSub}>Privacy Policy</Text>
            </View>
            <Ionicons name="shield-half" size={26} color="#fff" />
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroText}>
              نلتزم بحماية بياناتك ومعلوماتك الوظيفية بأعلى معايير الأمان والخصوصية داخل بيئة عمل الشركة العامة للمطارات والملاحة الجوية.
            </Text>
            <Text style={styles.heroMeta}>آخر تحديث: تموز / يوليو 2026</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((s, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name={s.icon} size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            <Text style={styles.cardBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footer}>© GCAAN 2026 — جميع الحقوق محفوظة</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  headerSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroText: { color: "#fff", fontSize: 13, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  heroMeta: { color: "#cbd5e1", fontSize: 11, marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 10,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardBody: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },
  footer: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 16,
  },
});
