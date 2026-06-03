import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import useAuthStore from "../store/authStore";
import useCompilerStore from "../store/compilerStore";

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const updateUser = useAuthStore(s => s.updateUser);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const setSource = useCompilerStore(s => s.setSource);

  return (
    <DashboardLayout
      user={user}
      token={token}
      updateUser={updateUser}
      clearAuth={clearAuth}
      setSource={setSource}
      navigate={navigate}
    />
  );
}
