import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

const arabicFont = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
    direction: rtl;
    text-align: right;
    color: #0F172A;
    margin: 0;
    padding: 0;
  }
  h1 { color: #1E3A8A; font-size: 22px; margin: 0 0 4px; }
  h2 { color: #1E3A8A; font-size: 16px; margin: 18px 0 8px; border-bottom: 2px solid #1E3A8A; padding-bottom: 4px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1E3A8A; padding-bottom: 10px; margin-bottom: 16px; }
  .company { font-size: 13px; color: #475569; }
  .date { font-size: 12px; color: #94A3B8; }
  .stats { display: flex; gap: 8px; margin: 12px 0; }
  .stat { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: 800; color: #1E3A8A; }
  .stat-label { font-size: 11px; color: #475569; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th { background: #1E3A8A; color: #fff; padding: 8px; text-align: right; font-weight: 700; }
  td { padding: 7px 8px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge-ok { background: #D1FAE5; color: #059669; }
  .badge-pending { background: #FEF3C7; color: #D97706; }
  .badge-rej { background: #FEE2E2; color: #DC2626; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; text-align: center; }
  .rate-bar { background: #E2E8F0; height: 6px; border-radius: 999px; overflow: hidden; margin-top: 4px; }
  .rate-bar-fill { background: #1E3A8A; height: 100%; }
`;

const STATUS_AR: Record<string, string> = {
  pending_division: "بانتظار الشعبة",
  pending_department: "بانتظار القسم",
  pending_gm: "بانتظار المدير",
  approved: "معتمد",
  rejected: "مرفوض",
};

function statusBadge(status: string) {
  const cls = status === "approved" ? "badge-ok" : status === "rejected" ? "badge-rej" : "badge-pending";
  return `<span class="badge ${cls}">${STATUS_AR[status] || status}</span>`;
}

function headerHtml(title: string) {
  const now = new Date().toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
    <div class="header">
      <div>
        <h1>${title}</h1>
        <div class="company">الشركة العامة لإدارة المطارات والملاحة الجوية</div>
      </div>
      <div class="date">${now}</div>
    </div>
  `;
}

function footerHtml() {
  return `<div class="footer">GCAAN ACTIVT © 2026 — تصميم المهندس معاد كاظم</div>`;
}

export function buildPeriodReportHtml(data: any, title: string): string {
  const activities = data?.activities || [];
  const approved = activities.filter((a: any) => a.status === "approved").length;
  const pending = activities.filter((a: any) => a.status?.startsWith("pending")).length;
  const rejected = activities.filter((a: any) => a.status === "rejected").length;

  const rows = activities.map((a: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${a.activity_type || ""}</td>
      <td>${a.employee_department_name || "-"}</td>
      <td>${a.activity_date || ""}</td>
      <td>${statusBadge(a.status)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml(title)}
    <div class="stats">
      <div class="stat"><div class="stat-value">${activities.length}</div><div class="stat-label">إجمالي</div></div>
      <div class="stat"><div class="stat-value" style="color:#10B981">${approved}</div><div class="stat-label">معتمد</div></div>
      <div class="stat"><div class="stat-value" style="color:#F59E0B">${pending}</div><div class="stat-label">قيد المراجعة</div></div>
      <div class="stat"><div class="stat-value" style="color:#EF4444">${rejected}</div><div class="stat-label">مرفوض</div></div>
    </div>
    <h2>تفاصيل النشاطات</h2>
    ${activities.length ? `<table>
      <thead><tr><th>#</th><th>نوع النشاط</th><th>القسم الذي قام بالنشاط</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : `<p style="text-align:center;color:#94A3B8;padding:20px">لا توجد نشاطات في هذه الفترة</p>`}
    ${footerHtml()}
  </body></html>`;
}

export function buildByDepartmentHtml(data: any[]): string {
  const rows = data.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.department_name}</td>
      <td>${d.total}</td>
      <td>${d.approved}</td>
      <td>${d.pending}</td>
      <td>${d.rejected}</td>
      <td>
        <strong>${d.approval_rate}%</strong>
        <div class="rate-bar"><div class="rate-bar-fill" style="width:${d.approval_rate}%"></div></div>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml("تقرير النشاطات حسب الأقسام")}
    <h2>الملخص التنفيذي</h2>
    <table>
      <thead><tr><th>#</th><th>القسم</th><th>الإجمالي</th><th>معتمد</th><th>بانتظار</th><th>مرفوض</th><th>نسبة الاعتماد</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>`}</tbody>
    </table>
    ${footerHtml()}
  </body></html>`;
}

export function buildCompletionHtml(data: any[]): string {
  const rows = data.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.employee_name}</td>
      <td>${e.total}</td>
      <td>${e.approved}</td>
      <td>${e.rejected}</td>
      <td>
        <strong>${e.completion_rate}%</strong>
        <div class="rate-bar"><div class="rate-bar-fill" style="width:${e.completion_rate}%"></div></div>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml("تقرير نسب الإنجاز")}
    <table>
      <thead><tr><th>#</th><th>الموظف</th><th>إجمالي النشاطات</th><th>معتمد</th><th>مرفوض</th><th>نسبة الإنجاز</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>`}</tbody>
    </table>
    ${footerHtml()}
  </body></html>`;
}

export function buildKpiHtml(data: any[]): string {
  const rows = data.map((k, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${k.employee_name}</td>
      <td>${k.total_activities}</td>
      <td>${k.approved}</td>
      <td>${k.approval_rate}%</td>
      <td>${k.avg_turnaround_days} يوم</td>
      <td><strong style="color:#1E3A8A">${k.kpi_score}</strong></td>
      <td>${k.rating}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml("تقرير مؤشرات الأداء (KPIs)")}
    <p style="background:#DBEAFE;padding:10px;border-radius:8px;font-size:12px;color:#1E3A8A">
      <strong>صيغة الحساب:</strong> 50% نسبة الاعتماد + 30% حجم النشاط + 20% سرعة الاعتماد
    </p>
    <table>
      <thead><tr><th>الترتيب</th><th>الموظف</th><th>نشاطات</th><th>معتمد</th><th>نسبة الاعتماد</th><th>متوسط الأيام</th><th>نقاط KPI</th><th>التقييم</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>`}</tbody>
    </table>
    ${footerHtml()}
  </body></html>`;
}

export function buildEmployeesActivitiesHtml(params: {
  deptName: string;
  employees: any[];
  activities: any[];
}): string {
  const { deptName, employees, activities } = params;

  const byEmp: Record<string, any[]> = {};
  for (const a of activities) {
    (byEmp[a.employee_id] = byEmp[a.employee_id] || []).push(a);
  }

  const employeeSections = employees.map((e, idx) => {
    const empActs = byEmp[e.employee_id] || [];
    const approved = empActs.filter((a) => a.status === "approved").length;
    const pending = empActs.filter((a) => (a.status || "").startsWith("pending")).length;
    const rejected = empActs.filter((a) => a.status === "rejected").length;
    const rows = empActs
      .map(
        (a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${a.activity_type || ""}</td>
        <td>${a.activity_date || ""}</td>
        <td>${statusBadge(a.status)}</td>
      </tr>`
      )
      .join("");
    return `
      <div style="margin-top:${idx === 0 ? 10 : 22}px;page-break-inside:avoid;">
        <div style="background:#0B3D91;color:#fff;padding:10px 14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:14px;">${idx + 1}. ${e.employee_name}</div>
          <div style="font-size:12px;background:rgba(255,255,255,0.18);padding:2px 10px;border-radius:999px;">
            نسبة الإنجاز: ${e.completion_rate || 0}%
          </div>
        </div>
        <div style="background:#F5F7FB;padding:8px 14px;border-bottom:1px solid #E4E7EC;font-size:11px;color:#4A5578;">
          إجمالي: ${empActs.length}  •  <span style="color:#12B76A;font-weight:700;">معتمد ${approved}</span>  •
          <span style="color:#F79009;font-weight:700;">قيد المراجعة ${pending}</span>  •
          <span style="color:#F04438;font-weight:700;">مرفوض ${rejected}</span>
        </div>
        ${empActs.length ? `<table><thead><tr><th>#</th><th>نوع النشاط</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>` : `<p style="text-align:center;color:#94A3B8;padding:14px;background:#fff;">لا توجد نشاطات</p>`}
      </div>`;
  }).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml(`تقرير نشاطات موظفي ${deptName}`)}
    <p style="background:#E8EEFB;padding:10px;border-radius:8px;font-size:12px;color:#0B3D91;">
      <strong>عدد الموظفين:</strong> ${employees.length} • <strong>إجمالي النشاطات:</strong> ${activities.length}
    </p>
    ${employees.length ? employeeSections : `<p style="text-align:center;color:#94A3B8;padding:20px;">لا يوجد موظفون</p>`}
    ${footerHtml()}
  </body></html>`;
}


export function buildDepartmentReportHtml(params: {
  deptName: string;
  summary: any;
  activities: any[];
  employees: any[];
}): string {
  const { deptName, summary, activities, employees } = params;

  const actRows = activities.map((a: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${a.activity_type || ""}</td>
      <td>${a.activity_date || ""}</td>
      <td>${statusBadge(a.status)}</td>
    </tr>
  `).join("");

  const empRows = employees.map((e: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.employee_name}</td>
      <td>${e.total}</td>
      <td>${e.approved}</td>
      <td>${e.rejected}</td>
      <td><strong>${e.completion_rate}%</strong>
        <div class="rate-bar"><div class="rate-bar-fill" style="width:${e.completion_rate}%"></div></div>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml(`تقرير القسم — ${deptName}`)}
    <div class="stats">
      <div class="stat"><div class="stat-value">${summary.total || 0}</div><div class="stat-label">إجمالي</div></div>
      <div class="stat"><div class="stat-value" style="color:#10B981">${summary.approved || 0}</div><div class="stat-label">معتمد</div></div>
      <div class="stat"><div class="stat-value" style="color:#F59E0B">${summary.pending || 0}</div><div class="stat-label">قيد المراجعة</div></div>
      <div class="stat"><div class="stat-value" style="color:#EF4444">${summary.rejected || 0}</div><div class="stat-label">مرفوض</div></div>
    </div>
    <h2>أداء العاملين في القسم</h2>
    ${employees.length ? `<table>
      <thead><tr><th>#</th><th>الاسم</th><th>الإجمالي</th><th>معتمد</th><th>مرفوض</th><th>نسبة الإنجاز</th></tr></thead>
      <tbody>${empRows}</tbody>
    </table>` : `<p style="text-align:center;color:#94A3B8;padding:20px">لا يوجد موظفون</p>`}
    <h2>نشاطات القسم</h2>
    ${activities.length ? `<table>
      <thead><tr><th>#</th><th>نوع النشاط</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>${actRows}</tbody>
    </table>` : `<p style="text-align:center;color:#94A3B8;padding:20px">لا توجد نشاطات</p>`}
    ${footerHtml()}
  </body></html>`;
}

export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === "web") {
    // Web: open in a new window and trigger print
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    return;
  }
  await Print.printAsync({ html });
}

export function buildRangeReportHtml(params: { data: any; deptName?: string }): string {
  const { data, deptName } = params;
  const scope = deptName ? deptName : "كل الشركة";

  const deptRows = (data.by_department || []).map((d: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.name}</td>
      <td>${d.total}</td>
      <td style="color:#12B76A;font-weight:700;">${d.approved}</td>
      <td style="color:#F79009;font-weight:700;">${d.pending}</td>
      <td style="color:#F04438;font-weight:700;">${d.rejected}</td>
    </tr>`).join("");

  const actRows = (data.activities || []).map((a: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${a.activity_type || ""}</td>
      <td>${a.employee_department_name || "-"}</td>
      <td>${a.activity_date || ""}</td>
      <td>${statusBadge(a.status)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml(`تقرير الفترة: ${data.from_date} إلى ${data.to_date}`)}
    <p style="background:#E8EEFB;padding:10px;border-radius:8px;font-size:12px;color:#0B3D91;">
      <strong>النطاق:</strong> ${scope}
    </p>
    <div class="stats">
      <div class="stat"><div class="stat-value">${data.count || 0}</div><div class="stat-label">إجمالي</div></div>
      <div class="stat"><div class="stat-value" style="color:#12B76A">${data.approved || 0}</div><div class="stat-label">معتمد</div></div>
      <div class="stat"><div class="stat-value" style="color:#F79009">${data.pending || 0}</div><div class="stat-label">قيد المراجعة</div></div>
      <div class="stat"><div class="stat-value" style="color:#F04438">${data.rejected || 0}</div><div class="stat-label">مرفوض</div></div>
    </div>
    <h2>ملخص حسب الأقسام</h2>
    ${deptRows ? `<table>
      <thead><tr><th>#</th><th>القسم</th><th>الإجمالي</th><th>معتمد</th><th>بانتظار</th><th>مرفوض</th></tr></thead>
      <tbody>${deptRows}</tbody>
    </table>` : `<p style="text-align:center;color:#94A3B8;padding:14px;">لا توجد أقسام بنشاطات</p>`}
    <h2>تفاصيل النشاطات</h2>
    ${actRows ? `<table>
      <thead><tr><th>#</th><th>نوع النشاط</th><th>القسم المنفّذ</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>${actRows}</tbody>
    </table>` : `<p style="text-align:center;color:#94A3B8;padding:14px;">لا توجد نشاطات في هذه الفترة</p>`}
    ${footerHtml()}
  </body></html>`;
}


export function buildComprehensiveHtml(data: any[]): string {
  const rows = data.map((r, i) => {
    const targets = r.targets && r.targets.length
      ? r.targets.map((t: any) => `${t.name} (${t.count})`).join("، ")
      : "-";
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${r.employee_name}</td>
      <td><strong>${r.total}</strong></td>
      <td>${r.employee_department_name || "-"}</td>
      <td>${targets}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <meta charset="UTF-8"><style>${arabicFont}</style></head><body>
    ${headerHtml("تقرير شامل بنشاطات الموظفين")}
    <p style="background:#E8EEFB;padding:10px;border-radius:8px;font-size:12px;color:#0B3D91;">
      <strong>عدد الموظفين:</strong> ${data.length}
    </p>
    <table>
      <thead><tr><th>#</th><th>الموظف</th><th>عدد النشاطات</th><th>القسم المنفّذ</th><th>الأقسام المستهدفة</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>`}</tbody>
    </table>
    ${footerHtml()}
  </body></html>`;
}

export async function exportPdf(html: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    // Fallback: open print dialog which lets user Save as PDF
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }
}

export async function downloadDocx(url: string, token: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return;
  }
  // Native: use expo-file-system dynamic import to avoid web bundle issues
  const FileSystem = await import("expo-file-system/legacy").catch(() => import("expo-file-system"));
  const fileUri = `${(FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory}${filename}`;
  const downloadRes = await (FileSystem as any).downloadAsync(url, fileUri, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(downloadRes.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      dialogTitle: filename,
    });
  }
}
