import { Route, Routes } from "react-router-dom";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminLoginPage } from "@/pages/AdminLoginPage";
import { AttendancePage } from "@/pages/AttendancePage";
import { PublicVisitorPage } from "@/pages/PublicVisitorPage";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";

export default function App() {
  return (
    <>
      <PWAInstallBanner />
      <Routes>
        <Route path="/" element={<AttendancePage />} />
        <Route path="/visitor" element={<PublicVisitorPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Routes>
    </>
  );
}
