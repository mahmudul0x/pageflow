import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Facebook, Globe2, Link2, Plus, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { authService } from "@/services/authService";
import { pageService } from "@/services/pageService";
import { useAppStore } from "@/store/useAppStore";
import type { FBPage } from "@/lib/mockData";

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const { data: initial = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const [pages, setPages] = useState<FBPage[]>([]);
  const [togglingPageId, setTogglingPageId] = useState<string | null>(null);

  useEffect(() => {
    setPages(initial);
  }, [initial]);

  const togglePage = async (id: string) => {
    try {
      setTogglingPageId(id);
      const response = await pageService.toggle(id);
      setPages((current) =>
        current.map((page) => (page.id === id ? { ...page, enabled: response.is_active } : page))
      );
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success(response.is_active ? "Page enabled for publishing." : "Page disabled for publishing.");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not update page status.");
    } finally {
      setTogglingPageId(null);
    }
  };

  const handleConnectFacebook = async () => {
    try {
      const data = await authService.getFacebookUrl("pages");
      window.location.href = data.auth_url;
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not start Facebook connection.");
    }
  };

  const handleSyncPages = async () => {
    try {
      const synced = await pageService.sync();
      setPages(synced);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success(`Synced ${synced.length} Facebook page${synced.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Could not sync Facebook pages.");
    }
  };

  const handleDisconnect = async () => {
    await authService.logout();
    logout();
    toast.success("Logged out successfully.");
    navigate("/");
  };

  const handleUpgrade = () => {
    window.location.href = "/#pricing";
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Delete your PageFlow account permanently? This cannot be undone.");
    if (!confirmed) return;

    try {
      await authService.deleteAccount();
      logout();
      toast.success("Your account has been deleted.");
      navigate("/");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not delete your account.");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[32px] bg-gradient-hero px-6 py-7 text-white shadow-elevated sm:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Account center</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings built for a professional publishing setup.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
          Manage your account identity, connected pages, and session security from one calmer control surface.
        </p>
      </section>

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Workspace preferences</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h2>
        <p className="text-muted-foreground">Manage your account and connected pages</p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="surface-panel rounded-[30px] border-none p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">Account</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-primary text-lg font-semibold text-primary-foreground">
                {user?.avatar || user?.name?.slice(0, 2).toUpperCase() || "PF"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user?.name || "PageFlow User"}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email || "No email"}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                {user?.facebook_id ? "Facebook connected" : "Facebook not connected yet"}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-xl sm:w-auto" onClick={handleUpgrade}>
              Upgrade
            </Button>
          </div>
        </Card>

        <Card className="surface-panel rounded-[30px] border-none p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
              <Link2 className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Connected pages</p>
              <p className="mt-2 text-3xl font-bold">{pages.length}</p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
              <Globe2 className="mb-3 h-5 w-5 text-accent" />
              <p className="text-sm text-muted-foreground">Publishing status</p>
              <p className="mt-2 text-lg font-semibold">{user?.facebook_id ? "Ready to sync" : "Needs connection"}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="surface-panel mb-6 rounded-[30px] border-none p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Connected Pages</h2>
            <p className="text-sm text-muted-foreground">Connect Facebook, then sync and manage the pages on your account</p>
          </div>
          <Button onClick={handleConnectFacebook} className="w-full gap-2 rounded-xl bg-gradient-primary shadow-elevated hover:opacity-90 sm:w-auto">
            <Plus className="h-4 w-4" /> Connect Facebook
          </Button>
        </div>

        <Button variant="outline" onClick={handleSyncPages} className="mb-4 w-full gap-2 rounded-xl sm:w-auto">
          <RefreshCcw className="h-4 w-4" /> Sync Facebook Pages
        </Button>

        <div className="space-y-3">
          {pages.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border p-6 text-sm text-muted-foreground">
              No pages yet. Connect Facebook and run sync to load all pages for this account.
            </div>
          ) : null}

          {pages.map((page) => (
            <div key={page.id} className="flex items-center gap-4 rounded-[24px] border border-border/70 bg-secondary/25 p-4 transition-colors hover:bg-secondary/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-xl text-white">
                {page.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{page.name}</p>
                <p className="text-xs text-muted-foreground">
                  {page.category} · {(page.followers / 1000).toFixed(1)}K followers
                </p>
              </div>
              <Switch
                checked={page.enabled}
                disabled={togglingPageId === page.id}
                onCheckedChange={() => void togglePage(page.id)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-[30px] border border-destructive/20 bg-destructive/5 p-4 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div>
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">These actions are irreversible</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-[24px] bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Log out</p>
              <p className="text-xs text-muted-foreground">Disconnect this session and return to the home page</p>
            </div>
            <Button variant="outline" onClick={handleDisconnect} className="w-full gap-2 rounded-xl sm:w-auto">
              <Facebook className="h-4 w-4" /> Logout
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-[24px] bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your PageFlow account</p>
            </div>
            <Button variant="destructive" className="w-full gap-2 rounded-xl sm:w-auto" onClick={handleDeleteAccount}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
