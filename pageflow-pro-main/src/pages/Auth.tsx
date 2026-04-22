import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Facebook, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { authService } from "@/services/authService";
import { pageService } from "@/services/pageService";
import { useAppStore } from "@/store/useAppStore";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const login = useAppStore((s) => s.login);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const code = searchParams.get("code");
  const callbackError = searchParams.get("error");

  useEffect(() => {
    if (!code && !callbackError) return;

    if (callbackError) {
      toast.error("Facebook login was cancelled or failed.");
      return;
    }

    let active = true;
    const completeFacebookAuth = async () => {
      try {
        setFacebookLoading(true);
        const data = await authService.facebookCallback(code!);
        if (!active) return;
        login(data);
        const pages = await pageService.sync();
        await queryClient.invalidateQueries({ queryKey: ["pages"] });
        toast.success(
          pages.length
            ? `Facebook connected. ${pages.length} page${pages.length === 1 ? "" : "s"} synced.`
            : "Facebook connected, but no pages were found for this account."
        );
        navigate("/dashboard/settings", { replace: true });
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.error || "Facebook login failed.");
      } finally {
        if (active) setFacebookLoading(false);
      }
    };

    void completeFacebookAuth();
    return () => {
      active = false;
    };
  }, [code, callbackError, login, navigate, queryClient]);

  useEffect(() => {
    if (location.pathname === "/auth/callback" && !code && !callbackError) {
      navigate("/auth", { replace: true });
    }
  }, [location.pathname, navigate, code, callbackError]);

  const updateField = (field: "name" | "email" | "password", value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = mode === "register"
        ? await authService.register(form)
        : await authService.login({ email: form.email, password: form.password });

      login(response);
      toast.success(mode === "register" ? "Account created. Continue with Facebook." : "Login successful. Continue with Facebook.");
      await handleFacebookLogin();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      setFacebookLoading(true);
      const data = await authService.getFacebookUrl("pages");
      window.location.href = data.auth_url;
    } catch (error: any) {
      setFacebookLoading(false);
      toast.error(error?.response?.data?.error || "Could not start Facebook login.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(239_100%_94%),_transparent_70%)]" />

      <Link to="/" className="absolute top-6 left-6 z-10">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </Link>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10 border-border shadow-elevated">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome to PageFlow</h1>
            <p className="text-muted-foreground text-sm">
              Create your account, log in, then connect Facebook to load all of your pages.
            </p>
          </div>

          <Tabs value={mode} onValueChange={(value) => setMode(value as "login" | "register")} className="mb-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Rahim Ahmed"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <Button type="submit" disabled={loading || facebookLoading} className="w-full h-11">
              {loading ? "Please wait..." : mode === "register" ? "Create account" : "Login"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Then connect Facebook</span>
            </div>
          </div>

          <Button
            onClick={handleFacebookLogin}
            disabled={loading || facebookLoading}
            className="w-full h-12 text-base font-semibold bg-facebook hover:bg-facebook/90 text-facebook-foreground shadow-md gap-3"
          >
            <Facebook className="h-5 w-5" fill="currentColor" />
            {facebookLoading ? "Opening Facebook..." : "Login Facebook And Fetch Pages"}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4 leading-relaxed">
            After Facebook approval, we sync the pages that belong to the logged-in account.
          </p>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <p className="leading-relaxed">
                Your data is encrypted end-to-end. We only request the Facebook permissions needed to read your pages and publish approved posts.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
