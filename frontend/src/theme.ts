// Modern GCAAN palette — sophisticated blue with teal + warm accents
export const COLORS = {
  bg: "#F5F7FB",
  surface: "#FFFFFF",

  // Primary — deep royal blue with slightly warmer tone
  primary: "#0B3D91",
  primaryDark: "#062561",
  primaryHover: "#1449A8",
  primaryLight: "#E8EEFB",

  // Accent — modern teal for highlights & CTAs
  accent: "#0EA5A5",
  accentBg: "#CFF5F0",

  // Secondary — sky blue
  secondary: "#0EA5E9",
  secondaryBg: "#DBF0FE",

  // Warm accent — coral/amber
  warm: "#F97066",
  warmBg: "#FEE4E2",
  gold: "#F5A524",
  goldBg: "#FEF3C7",

  // Text
  textPrimary: "#0B1220",
  textSecondary: "#4A5578",
  textMuted: "#98A2B3",

  // Neutrals
  border: "#E4E7EC",
  borderLight: "#F2F4F7",

  // States
  success: "#12B76A",
  successBg: "#D1FADF",
  warning: "#F79009",
  warningBg: "#FEF0C7",
  danger: "#F04438",
  dangerBg: "#FEE4E2",
  info: "#2E90FA",
  infoBg: "#D1E9FF",
};

export const GRADIENTS = {
  primary: ["#062561", "#0B3D91", "#1449A8"] as [string, string, string],
  hero: ["#0B3D91", "#0EA5A5"] as [string, string],
  accent: ["#0EA5A5", "#12B76A"] as [string, string],
  warm: ["#F5A524", "#F97066"] as [string, string],
};

export const ROLE_LABEL: Record<string, string> = {
  general_manager: "مكتب المدير العام",
  department_manager: "مدير قسم",
  division_manager: "مدير شعبة",
  employee: "موظف",
};

export const STATUS_LABEL: Record<string, string> = {
  pending_division: "بانتظار مدير الشعبة",
  pending_department: "بانتظار مدير القسم",
  pending_gm: "بانتظار مكتب المدير العام",
  approved: "معتمد",
  rejected: "مرفوض",
};

export const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  pending_division: { bg: COLORS.warningBg, fg: COLORS.warning },
  pending_department: { bg: COLORS.warningBg, fg: COLORS.warning },
  pending_gm: { bg: COLORS.infoBg, fg: COLORS.info },
  approved: { bg: COLORS.successBg, fg: COLORS.success },
  rejected: { bg: COLORS.dangerBg, fg: COLORS.danger },
};
