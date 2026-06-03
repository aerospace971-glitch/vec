import { useEffect, useState } from "react";

export const METAMIC_SETTINGS_KEY = "metamic_settings";
export const METAMIC_SETTINGS_EVENT = "metamic-settings-change";

export const DEFAULT_METAMIC_SETTINGS = {
  fontSize: 12,
  tabSize: 2,
  autosave: true,
};

function normalizeSettings(value) {
  return {
    ...DEFAULT_METAMIC_SETTINGS,
    ...(value || {}),
    fontSize: Math.min(20, Math.max(10, Number(value?.fontSize) || DEFAULT_METAMIC_SETTINGS.fontSize)),
    tabSize: [2, 4, 8].includes(Number(value?.tabSize)) ? Number(value.tabSize) : DEFAULT_METAMIC_SETTINGS.tabSize,
  };
}

export function readMetamicSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(METAMIC_SETTINGS_KEY)));
  } catch {
    return DEFAULT_METAMIC_SETTINGS;
  }
}

export function writeMetamicSettings(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(METAMIC_SETTINGS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(METAMIC_SETTINGS_EVENT, { detail: normalized }));
  return normalized;
}

export function useMetamicSettings() {
  const [settings, setSettings] = useState(readMetamicSettings);

  useEffect(() => {
    function sync(event) {
      setSettings(event.detail || readMetamicSettings());
    }

    function syncFromStorage(event) {
      if (event.key === METAMIC_SETTINGS_KEY) setSettings(readMetamicSettings());
    }

    window.addEventListener(METAMIC_SETTINGS_EVENT, sync);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(METAMIC_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  return settings;
}
