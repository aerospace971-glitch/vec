import { useState, useEffect } from "react";
import { BREAKPOINTS, DEVICE, getDeviceFromWidth } from "../constants/responsiveConfig";

export function useResponsive() {
  const [state, setState] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth  : 1366;
    const h = typeof window !== "undefined" ? window.innerHeight : 768;
    return buildState(w, h);
  });

  useEffect(() => {
    function onResize() {
      setState(buildState(window.innerWidth, window.innerHeight));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return state;
}

function buildState(w, h) {
  const device = getDeviceFromWidth(w);
  return {
    width:       w,
    height:      h,
    device,
    isMobile:    device === DEVICE.MOBILE,
    isTablet:    device === DEVICE.TABLET,
    isLaptop:    device === DEVICE.LAPTOP,
    isDesktop:   device === DEVICE.DESKTOP,
    isUltraWide: device === DEVICE.ULTRAWIDE,
    isPortrait:  h > w,
    isLandscape: w >= h,
    // convenience combos
    isMobileOrTablet: device === DEVICE.MOBILE || device === DEVICE.TABLET,
    isLaptopOrAbove:  device === DEVICE.LAPTOP  || device === DEVICE.DESKTOP || device === DEVICE.ULTRAWIDE,
  };
}
