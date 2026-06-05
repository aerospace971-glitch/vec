// ─── Breakpoints (px) ──────────────────────────────────────────────────────
export const BREAKPOINTS = {
  mobileS:   320,
  mobileM:   390,
  mobileL:   414,
  foldable:  673,
  tabletS:   768,
  tabletM:   820,
  tabletL:   1024,
  laptop:    1366,
  desktop:   1920,
  ultrawide: 2560,
};

// ─── Device enum ───────────────────────────────────────────────────────────
export const DEVICE = {
  MOBILE:    "MOBILE",    // < 768
  TABLET:    "TABLET",    // 768 – 1023
  LAPTOP:    "LAPTOP",    // 1024 – 1365
  DESKTOP:   "DESKTOP",  // 1366 – 1919
  ULTRAWIDE: "ULTRAWIDE", // >= 1920
};

// ─── Layout dimensions per device ──────────────────────────────────────────
export const LAYOUT = {
  sidebarWidth: {
    [DEVICE.MOBILE]:    0,
    [DEVICE.TABLET]:    48,
    [DEVICE.LAPTOP]:    200,
    [DEVICE.DESKTOP]:   200,
    [DEVICE.ULTRAWIDE]: 220,
  },
  explorerWidth: {
    [DEVICE.MOBILE]:    0,
    [DEVICE.TABLET]:    180,
    [DEVICE.LAPTOP]:    220,
    [DEVICE.DESKTOP]:   220,
    [DEVICE.ULTRAWIDE]: 260,
  },
  navbarHeight: {
    [DEVICE.MOBILE]:    48,
    [DEVICE.TABLET]:    52,
    [DEVICE.LAPTOP]:    52,
    [DEVICE.DESKTOP]:   52,
    [DEVICE.ULTRAWIDE]: 60,
  },
  modalWidth: {
    [DEVICE.MOBILE]:    "100%",
    [DEVICE.TABLET]:    "460px",
    [DEVICE.LAPTOP]:    "460px",
    [DEVICE.DESKTOP]:   "460px",
    [DEVICE.ULTRAWIDE]: "520px",
  },
  panelHeight: {
    [DEVICE.MOBILE]:    "50vh",
    [DEVICE.TABLET]:    "60vh",
    [DEVICE.LAPTOP]:    "100%",
    [DEVICE.DESKTOP]:   "100%",
    [DEVICE.ULTRAWIDE]: "100%",
  },
};

// ─── Typography (clamp values) ──────────────────────────────────────────────
export const TYPOGRAPHY = {
  xs:  "clamp(10px, 1.2vw, 11px)",
  sm:  "clamp(11px, 1.4vw, 13px)",
  md:  "clamp(13px, 1.6vw, 15px)",
  lg:  "clamp(16px, 2vw,   20px)",
  xl:  "clamp(20px, 2.5vw, 28px)",
  "2xl":"clamp(28px, 4vw,  48px)",
};

// ─── Spacing scale (4px base) ───────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  "2xl": 48,
};

// ─── Container max-widths ───────────────────────────────────────────────────
export const CONTAINER = {
  [DEVICE.MOBILE]:    "100%",
  [DEVICE.TABLET]:    "768px",
  [DEVICE.LAPTOP]:    "1200px",
  [DEVICE.DESKTOP]:   "1600px",
  [DEVICE.ULTRAWIDE]: "2200px",
};

// ─── Grid columns ───────────────────────────────────────────────────────────
export const GRID = {
  [DEVICE.MOBILE]:    1,
  [DEVICE.TABLET]:    2,
  [DEVICE.LAPTOP]:    2,
  [DEVICE.DESKTOP]:   3,
  [DEVICE.ULTRAWIDE]: 4,
};

// ─── Pure utility functions ─────────────────────────────────────────────────
export function getDeviceFromWidth(width) {
  if (width < BREAKPOINTS.tabletS)  return DEVICE.MOBILE;
  if (width < BREAKPOINTS.tabletL)  return DEVICE.TABLET;
  if (width < BREAKPOINTS.laptop)   return DEVICE.LAPTOP;
  if (width < BREAKPOINTS.desktop)  return DEVICE.DESKTOP;
  return DEVICE.ULTRAWIDE;
}

export function getFontSize(level, _device) {
  return TYPOGRAPHY[level] ?? TYPOGRAPHY.md;
}

export function getSpacing(size) {
  return `${SPACING[size] ?? SPACING.md}px`;
}

export function getGridColumns(device) {
  return GRID[device] ?? 1;
}

export function getEditorHeight(device) {
  const map = {
    [DEVICE.MOBILE]:    "40vh",
    [DEVICE.TABLET]:    "50vh",
    [DEVICE.LAPTOP]:    "calc(100vh - 180px)",
    [DEVICE.DESKTOP]:   "calc(100vh - 180px)",
    [DEVICE.ULTRAWIDE]: "calc(100vh - 180px)",
  };
  return map[device] ?? "calc(100vh - 180px)";
}

export function getPanelWidth(device) {
  const map = {
    [DEVICE.MOBILE]:    "100%",
    [DEVICE.TABLET]:    "50%",
    [DEVICE.LAPTOP]:    "33.33%",
    [DEVICE.DESKTOP]:   "33.33%",
    [DEVICE.ULTRAWIDE]: "25%",
  };
  return map[device] ?? "33.33%";
}
