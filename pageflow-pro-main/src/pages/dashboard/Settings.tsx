import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Facebook, Plus, RefreshCcw, Trash2 } from "lucide-react";
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
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const { data: initial = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const [pages, setPages] = useState<FBPage[]>([]);

  useEffect(() => {
    setPages(initial);
  }, [initial]);

  const togglePage = (id: string) => {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, enabled: !page.enabled } : page)));
    toast.success("Page updated locally.");
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

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto pt-20 lg:pt-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connected pages</p>
      </div>

      <Card className="p-4 sm:p-6 border-border mb-6">
        <h2 className="font-semibold mb-4">Account</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-lg font-semibold">
              {user?.avatar || user?.name?.slice(0, 2).toUpperCase() || "PF"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user?.name || "PageFlow User"}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email || "No email"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {user?.facebook_id ? "Facebook connected" : "Facebook not connected yet"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            Upgrade
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-border mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold">Connected Pages</h2>
            <p className="text-sm text-muted-foreground">Connect Facebook, then sync and manage the pages on your account</p>
          </div>
          <Button onClick={handleConnectFacebook} className="gap-2 bg-gradient-primary hover:opacity-90 shadow-elevated w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Connect Facebook
          </Button>
        </div>

        <Button variant="outline" onClick={handleSyncPages} className="gap-2 mb-4 w-full sm:w-auto">
          <RefreshCcw className="h-4 w-4" /> Sync Facebook Pages
        </Button>

        <div className="space-y-2">
          {pages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No pages yet. Connect Facebook and run sync to load all pages for this account.
            </div>
          )}

          {pages.map((page) => (
            <div key={page.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-xl">
                {page.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{page.name}</p>
                <p className="text-xs text-muted-foreground">
                  {page.category} · {(page.followers / 1000).toFixed(1)}K followers
                </p>
              </div>
              <Switch checked={page.enabled} onCheckedChange={() => togglePage(page.id)} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6 border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">These actions are irreversible</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-background border border-border">
            <div>
              <p className="font-medium text-sm">Log out</p>
              <p className="text-xs text-muted-foreground">Disconnect this session and return to the home page</p>
            </div>
            <Button variant="outline" onClick={handleDisconnect} className="gap-2 w-full sm:w-auto">
              <Facebook className="h-4 w-4" /> Logout
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-background border border-border">
            <div>
              <p className="font-medium text-sm">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your PageFlow account</p>
            </div>
            <Button variant="destructive" className="gap-2 w-full sm:w-auto">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
