import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, PenSquare, Calendar, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import { toast } from "sonner";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/create-post", label: "Create Post", icon: PenSquare },
  { to: "/dashboard/scheduled", label: "Scheduled Posts", icon: Calendar },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const DashboardLayout = () => {
  const navigate = useNavigate();
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 h-10 w-10 rounded-lg bg-sidebar text-sidebar-foreground flex items-center justify-center shadow-lg"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col z-40 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6">
          <Logo variant="light" />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
                {user?.avatar || user?.name?.slice(0, 2).toUpperCase() || "PF"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "PageFlow User"}</p>
              <p className="text-xs text-sidebar-foreground truncate">{user?.email || "No email"}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleLogout}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        />
      )}

      <main className="flex-1 min-w-0 w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
