import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { COLORS, GRADIENTS } from "@/src/theme";

type SystemInfo = {
  database: string;
  total_data_bytes: number;
  total_storage_bytes: number;
  index_bytes: number;
  objects: number;
  collections: { name: string; count: number; size_bytes: number; storage_bytes: number }[];
  generated_at: string;
};

type Subscription = {
  start_date: string;
  end_date: string;
  note?: string;
  configured?: boolean;
  updated_at?: string;
  updated_by_name?: string;
  days_remaining: number;
  days_total: number;
  percent_used: number;
  expired: boolean;
};

const COLLECTION_LABEL: Record<string, string> = {
  users: "المستخدمون",
  departments: "الأقسام",
  divisions: "الشعب",
  activities: "النشاطات",
};

const COLLECTION_ICON: Record<string, any> = {
  users: "people",
  departments: "business",
  divisions: "git-branch",
  activities: "documents",
};

const COLLECTION_COLOR: Record<string, string> = {
  users: COLORS.primary,
  departments: COLORS.accent,
  divisions: COLORS.secondary,
  activities: COLORS.gold,
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} كيلوبايت`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} ميغابايت`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} غيغابايت`;
}

export default function SystemScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState<{ start_date: string; end_date: string; note: string }>({
    start_date: "",
    end_date: "",
    note: "",
  });
  const [subSaving, setSubSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"backup" | "restore" | "analysis" | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([
        api.get<SystemInfo>("/admin/system-info"),
        api.get<Subscription>("/admin/subscription"),
      ]);
      setInfo(i);
      setSub(s);
    } catch (e: any) {
      setMessage({ type: "err", text: e.message || "فشل التحميل" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const backup = async () => {
    setBusy("backup");
    setMessage(null);
    try {
      const token = await storage.secureGet("gcaan_token", "");
      const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const url = `${base}/api/admin/backup`;
      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `gcaan-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        const FileSystem: any = await import("expo-file-system/legacy").catch(() =>
          import("expo-file-system")
        );
        const Sharing: any = await import("expo-sharing");
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}gcaan-backup.json`;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType: "application/json",
            dialogTitle: "نسخة احتياطية GCAAN",
          });
        }
      }
      setMessage({ type: "ok", text: "تم توليد النسخة الاحتياطية بنجاح" });
    } catch (e: any) {
      setMessage({ type: "err", text: e.message || "فشل النسخ الاحتياطي" });
    } finally {
      setBusy(null);
    }
  };

  const downloadAnalysisDoc = async () => {
    setBusy("analysis");
    setMessage(null);
    try {
      const token = await storage.secureGet("gcaan_token", "");
      const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const url = `${base}/api/admin/analysis-doc`;
      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("فشل تحميل ملف التحليل");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `GCAAN_ACTIVT_Analysis.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        const FileSystem: any = await import("expo-file-system/legacy").catch(() =>
          import("expo-file-system")
        );
        const Sharing: any = await import("expo-sharing");
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}GCAAN_ACTIVT_Analysis.docx`;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            dialogTitle: "تحليل نظام GCAAN",
          });
        }
      }
      setMessage({ type: "ok", text: "تم تحميل ملف تحليل النظام بنجاح" });
    } catch (e: any) {
      setMessage({ type: "err", text: e.message || "فشل تحميل ملف التحليل" });
    } finally {
      setBusy(null);
    }
  };

  const openSubModal = () => {
    setSubForm({
      start_date: sub?.start_date || "",
      end_date: sub?.end_date || "",
      note: sub?.note || "",
    });
    setSubModalOpen(true);
  };

  const saveSubscription = async () => {
    setSubSaving(true);
    setMessage(null);
    try {
      const payload: any = {
        start_date: subForm.start_date || undefined,
        end_date: subForm.end_date || undefined,
        note: subForm.note || undefined,
      };
      const updated = await api.post<Subscription>("/admin/subscription", payload);
      setSub(updated);
      setSubModalOpen(false);
      setMessage({ type: "ok", text: "تم تحديث فترة الاشتراك بنجاح" });
    } catch (e: any) {
      setMessage({ type: "err", text: e.message || "فشل التحديث" });
    } finally {
      setSubSaving(false);
    }
  };

  const applyQuickDuration = (days: number) => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + days);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setSubForm((f) => ({ ...f, start_date: iso(today), end_date: iso(end) }));
  };

  const restore = async () => {
    setMessage(null);
    if (Platform.OS !== "web") {
      setMessage({ type: "err", text: "الاستعادة من ملف متاحة حالياً من نسخة الويب" });
      return;
    }
    const confirmed = confirm(
      "⚠️ تحذير: الاستعادة ستستبدل جميع البيانات الحالية بالنسخة الاحتياطية.\nهل أنت متأكد؟"
    );
    if (!confirmed) return;
    // Trigger file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setBusy("restore");
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const res = await api.post<any>("/admin/restore", payload);
        setMessage({
          type: "ok",
          text: `تمت الاستعادة بنجاح: ${JSON.stringify(res.restored)}`,
        });
        await load();
      } catch (e: any) {
        setMessage({ type: "err", text: e.message || "فشل الاستعادة" });
      } finally {
        setBusy(null);
      }
    };
    input.click();
  };

  return (
    <View style={styles.container} testID="system-screen">
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>إدارة النظام</Text>
              <Text style={styles.headerSub}>System Administration</Text>
            </View>
            <Ionicons name="server" size={26} color="#fff" />
          </View>

          {info && (
            <View style={styles.heroCard}>
              <View>
                <Text style={styles.heroLabel}>إجمالي البيانات المخزّنة</Text>
                <Text style={styles.heroValue}>{fmtBytes(info.total_data_bytes)}</Text>
                <View style={styles.heroMeta}>
                  <View style={styles.metaChip}>
                    <Ionicons name="cube" size={12} color="#e2e8f0" />
                    <Text style={styles.metaText}>{info.objects} سجل</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name="hardware-chip" size={12} color="#e2e8f0" />
                    <Text style={styles.metaText}>{fmtBytes(info.total_storage_bytes)} تخزين</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {sub && (
            <View style={styles.subHeroCard} testID="sub-header-card">
              <View style={styles.subHeroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>
                    {sub.expired ? "الاشتراك منتهي" : "المتبقي من فترة الاشتراك"}
                  </Text>
                  <View style={styles.subDaysRow}>
                    <Text
                      style={[
                        styles.subDaysValue,
                        sub.expired
                          ? { color: "#fecaca" }
                          : sub.days_remaining <= 15
                          ? { color: "#fde68a" }
                          : { color: "#fff" },
                      ]}
                    >
                      {sub.days_remaining}
                    </Text>
                    <Text style={styles.subDaysUnit}>يوم</Text>
                    {sub.expired && (
                      <Ionicons name="alert-circle" size={20} color="#fecaca" style={{ marginRight: 6 }} />
                    )}
                  </View>
                  <Text style={styles.subDates}>
                    {sub.start_date} → {sub.end_date}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.subEditBtn}
                  onPress={openSubModal}
                  testID="edit-subscription-btn"
                  activeOpacity={0.85}
                >
                  <Ionicons name="create" size={16} color="#fff" />
                  <Text style={styles.subEditText}>تعديل</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(sub.percent_used, 100)}%`,
                      backgroundColor: sub.expired
                        ? "#ef4444"
                        : sub.days_remaining <= 15
                        ? "#f59e0b"
                        : "#22c55e",
                    },
                  ]}
                />
              </View>
              <View style={styles.subFooterRow}>
                <Text style={styles.subFooterText}>
                  مضى {sub.percent_used}% من مدة {sub.days_total} يوم
                </Text>
                {!sub.configured && (
                  <Text style={styles.subFooterHint}>لم يُضبط بعد</Text>
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {!!message && (
          <View style={[styles.msg, { backgroundColor: message.type === "ok" ? COLORS.successBg : COLORS.dangerBg }]} testID="system-message">
            <Ionicons
              name={message.type === "ok" ? "checkmark-circle" : "alert-circle"}
              size={16}
              color={message.type === "ok" ? COLORS.success : COLORS.danger}
            />
            <Text style={{ color: message.type === "ok" ? COLORS.success : COLORS.danger, flex: 1, fontSize: 12 }}>
              {message.text}
            </Text>
          </View>
        )}

        {/* Collections */}
        <Text style={styles.sectionTitle}>محتوى قاعدة البيانات</Text>
        {info?.collections.map((c) => (
          <View key={c.name} style={styles.collRow} testID={`coll-${c.name}`}>
            <View style={[styles.collIcon, { backgroundColor: COLLECTION_COLOR[c.name] + "18" }]}>
              <Ionicons name={COLLECTION_ICON[c.name]} size={20} color={COLLECTION_COLOR[c.name]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collName}>{COLLECTION_LABEL[c.name] || c.name}</Text>
              <Text style={styles.collSub}>{fmtBytes(c.size_bytes)}</Text>
            </View>
            <View style={styles.collCount}>
              <Text style={styles.collCountValue}>{c.count}</Text>
              <Text style={styles.collCountLabel}>سجل</Text>
            </View>
          </View>
        ))}

        {/* Backup + Restore */}
        <Text style={styles.sectionTitle}>النسخ الاحتياطي والاستعادة</Text>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="download" size={22} color={COLORS.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>نسخة احتياطية</Text>
              <Text style={styles.cardDesc}>حمّل نسخة كاملة من جميع البيانات (JSON)</Text>
            </View>
          </View>
          <TouchableOpacity
            testID="backup-btn"
            style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
            onPress={backup}
            disabled={busy !== null}
            activeOpacity={0.85}
          >
            {busy === "backup" ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="cloud-download" size={18} color="#fff" />
                <Text style={styles.actionText}>تنزيل نسخة احتياطية</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="cloud-upload" size={22} color={COLORS.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>استعادة من نسخة احتياطية</Text>
              <Text style={styles.cardDesc}>سيتم استبدال جميع البيانات الحالية بمحتوى الملف</Text>
            </View>
          </View>
          <View style={styles.warnBox}>
            <Ionicons name="warning" size={14} color={COLORS.warning} />
            <Text style={{ color: COLORS.warning, flex: 1, fontSize: 11 }}>
              تحذير: هذا الإجراء لا يمكن التراجع عنه. تأكد من صحة الملف قبل الاستعادة
            </Text>
          </View>
          <TouchableOpacity
            testID="restore-btn"
            style={[styles.actionBtn, { backgroundColor: COLORS.warning }]}
            onPress={restore}
            disabled={busy !== null}
            activeOpacity={0.85}
          >
            {busy === "restore" ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="refresh-circle" size={18} color="#fff" />
                <Text style={styles.actionText}>اختر ملف واستعادة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Analysis Document Download */}
        <Text style={styles.sectionTitle}>وثيقة تحليل النظام</Text>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="document-text" size={22} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تحليل شامل للنظام (DOCX)</Text>
              <Text style={styles.cardDesc}>
                يحتوي على تحليل كامل للنظام، سير العمل، الأدوار، وقاعدة البيانات
              </Text>
            </View>
          </View>
          <TouchableOpacity
            testID="analysis-doc-btn"
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={downloadAnalysisDoc}
            disabled={busy !== null}
            activeOpacity={0.85}
          >
            {busy === "analysis" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.actionText}>تنزيل ملف التحليل الشامل</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {info && (
          <Text style={styles.footer}>آخر تحديث: {new Date(info.generated_at).toLocaleString("ar-IQ")}</Text>
        )}
      </ScrollView>

      {/* Subscription edit modal */}
      <Modal
        visible={subModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSubModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox} testID="subscription-modal">
            <View style={styles.modalHead}>
              <Ionicons name="calendar" size={22} color={COLORS.primary} />
              <Text style={styles.modalTitle}>تعديل فترة الاشتراك</Text>
              <TouchableOpacity onPress={() => setSubModalOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>تاريخ البداية</Text>
            <TextInput
              testID="sub-start-input"
              value={subForm.start_date}
              onChangeText={(v) => setSubForm((f) => ({ ...f, start_date: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>تاريخ الانتهاء</Text>
            <TextInput
              testID="sub-end-input"
              value={subForm.end_date}
              onChangeText={(v) => setSubForm((f) => ({ ...f, end_date: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>مدة سريعة</Text>
            <View style={styles.quickRow}>
              {[
                { label: "30 يوم", d: 30 },
                { label: "90 يوم", d: 90 },
                { label: "6 أشهر", d: 180 },
                { label: "سنة", d: 365 },
                { label: "سنتان", d: 730 },
              ].map((q) => (
                <TouchableOpacity
                  key={q.d}
                  style={styles.quickBtn}
                  onPress={() => applyQuickDuration(q.d)}
                  activeOpacity={0.85}
                  testID={`quick-${q.d}`}
                >
                  <Text style={styles.quickBtnText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>ملاحظات (اختياري)</Text>
            <TextInput
              testID="sub-note-input"
              value={subForm.note}
              onChangeText={(v) => setSubForm((f) => ({ ...f, note: v }))}
              placeholder="مثال: تم التجديد لعام كامل"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, { textAlign: "right" }]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.borderLight }]}
                onPress={() => setSubModalOpen(false)}
                disabled={subSaving}
                activeOpacity={0.85}
              >
                <Text style={{ color: COLORS.textPrimary, fontWeight: "800" }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="sub-save-btn"
                style={[styles.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={saveSubscription}
                disabled={subSaving}
                activeOpacity={0.85}
              >
                {subSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>حفظ</Text>
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
  header: { paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  headerSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroLabel: { color: "#cbd5e1", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  heroValue: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  heroMeta: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  metaText: { color: "#e2e8f0", fontSize: 11 },
  msg: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary, marginTop: 8, marginBottom: 12, textAlign: "right", writingDirection: "rtl" },
  collRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  collIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  collName: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  collSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  collCount: {
    alignItems: "center",
    padding: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    minWidth: 60,
  },
  collCountValue: { fontSize: 18, fontWeight: "900", color: COLORS.primary },
  collCountLabel: { fontSize: 9, color: COLORS.primary, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  cardDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  warnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.warningBg,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  footer: { fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginTop: 14 },

  // Subscription card in header
  subHeroCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  subHeroTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  subDaysRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  subDaysValue: { fontSize: 30, fontWeight: "900", color: "#fff", lineHeight: 34 },
  subDaysUnit: { fontSize: 13, color: "#cbd5e1", marginBottom: 6, fontWeight: "700" },
  subDates: { fontSize: 11, color: "#cbd5e1", marginTop: 6, textAlign: "right", writingDirection: "rtl" },
  subEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  subEditText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  progressTrack: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 999,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  subFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  subFooterText: { color: "#cbd5e1", fontSize: 11 },
  subFooterHint: { color: "#fde68a", fontSize: 10, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
  },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, textAlign: "right", writingDirection: "rtl" },
  modalClose: { padding: 4 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: "#fff",
    textAlign: "left",
  },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 999,
  },
  quickBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
