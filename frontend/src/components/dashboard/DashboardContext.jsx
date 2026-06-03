import { createContext, useContext } from "react";

export const DashboardContext = createContext(null);

export function useDashboardContext() {
  return useContext(DashboardContext);
}
