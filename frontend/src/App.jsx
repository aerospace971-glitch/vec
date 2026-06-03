import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CompilerApp from "./pages/CompilerApp";
import PhasePage   from "./pages/PhasePage";
import BuildPage from "./pages/BuildPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import RuntimePage from "./pages/RuntimePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/signin"    element={<SignInPage />} />
        <Route path="/signup"    element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/app"       element={<CompilerApp />} />
        <Route path="/build"     element={<BuildPage />} />
        <Route path="/lexer"     element={<PhasePage phase="lex"      />} />
        <Route path="/parser"    element={<PhasePage phase="parse"    />} />
        <Route path="/semantic"  element={<PhasePage phase="semantic" />} />
        <Route path="/ir"        element={<PhasePage phase="ir"       />} />
        <Route path="/optimizer" element={<PhasePage phase="opt"      />} />
        <Route path="/codegen"   element={<PhasePage phase="codegen"  />} />
        <Route path="/runtime"   element={<RuntimePage />} />
      </Routes>
    </BrowserRouter>
  );
}