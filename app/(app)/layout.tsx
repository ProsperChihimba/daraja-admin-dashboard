import RequireAuth from "@/components/auth/RequireAuth";
import AppSidebar from "@/components/shell/AppSidebar";
import Topbar from "@/components/shell/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-bg">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 flex-1 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
