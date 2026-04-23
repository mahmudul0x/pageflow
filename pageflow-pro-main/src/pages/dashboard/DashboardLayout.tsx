import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, PenSquare, Calendar, BarChart3, Settings, LogOut, Menu, X, Bell, Search, Files } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import { useAppStore } from "@/store/useAppStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/create-post", label: "Create Post", icon: PenSquare },
  { to: "/dashboard/posts", label: "All Posts", icon: Files },
  { to: "/dashboard/scheduled", label: "Scheduled Posts", icon: Calendar },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle =
    navItems.find((item) => item.to === location.pathname || (item.end && location.pathname === "/dashboard"))?.label || "Workspace";

  const handleLogout = async () => {
    await authService.logout();
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <button
        onClick={() => setMobileOpen((current) => !current)}
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl bg-sidebar text-sidebar-foreground shadow-elevated lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-r border-sidebar-border/70 bg-sidebar/95 px-5 pb-5 pt-6 text-sidebar-foreground backdrop-blur-xl transition-transform duration-300 lg:sticky lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <Logo variant="light" />
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                Pro
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-2 pb-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                    isActive ? "bg-white text-sidebar shadow-card" : "text-sidebar-foreground hover:bg-white/8 hover:text-white"
                  )
                }
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 transition-all group-hover:bg-white/12">
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                  {user?.avatar || user?.name?.slice(0, 2).toUpperCase() || "PF"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user?.name || "PageFlow User"}</p>
                <p className="truncate text-xs text-sidebar-foreground">{user?.email || "No email"}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-2 rounded-xl border border-white/10 bg-white/5 text-sidebar-foreground hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>

        {mobileOpen && (
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="pl-14 lg:pl-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">PageFlow Control</p>
                <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden min-w-[250px] items-center gap-3 rounded-2xl border border-border/70 bg-white/70 px-4 py-2.5 text-sm text-muted-foreground shadow-soft md:flex">
                  <Search className="h-4 w-4" />
                  Search posts, pages, or insights
                </div>
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/70 text-muted-foreground shadow-soft transition hover:text-foreground">
                  <Bell className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
