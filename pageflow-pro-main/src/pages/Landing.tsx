import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, BarChart3, Layers, Check, ArrowRight, Sparkles, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Layers,
    title: "Multi-page posting",
    desc: "Publish a single post to all your Facebook Pages at once. Save hours every week.",
  },
  {
    icon: Calendar,
    title: "Smart scheduling",
    desc: "Plan your content calendar weeks in advance with our intuitive scheduler.",
  },
  {
    icon: BarChart3,
    title: "Deep analytics",
    desc: "Track reach, engagement, and growth across every page from one dashboard.",
  },
];

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started",
    features: ["Up to 2 Pages", "10 posts/month", "Basic analytics", "Email support"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    desc: "For creators & small teams",
    features: ["Up to 10 Pages", "Unlimited posts", "Advanced analytics", "Smart scheduling", "Priority support"],
    cta: "Start Pro Trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$49",
    period: "/month",
    desc: "For agencies & power users",
    features: ["Unlimited Pages", "Unlimited posts", "Team collaboration", "White-label reports", "Dedicated manager"],
    cta: "Go Agency",
    highlight: false,
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 shadow-elevated">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-soft">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(239_100%_94%),_transparent_60%)]" />
        <div className="container relative py-16 sm:py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-semibold">
              <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
              Trusted by 12,000+ creators
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] md:leading-[1.05] mb-6">
              Manage all your <span className="text-gradient">Facebook Pages</span> in one place
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Schedule posts, track analytics, and publish to multiple pages simultaneously — all from a single, beautiful dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary hover:opacity-90 shadow-elevated h-12 px-8 text-base">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Watch demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">No credit card required • Free forever plan</p>
          </div>

          {/* Hero Preview */}
          <div className="mt-12 sm:mt-20 max-w-5xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
                <div className="h-3 w-3 rounded-full bg-destructive/50" />
                <div className="h-3 w-3 rounded-full bg-warning/50" />
                <div className="h-3 w-3 rounded-full bg-success/50" />
              </div>
              <div className="grid grid-cols-12 min-h-[280px] sm:min-h-[380px]">
                <div className="col-span-4 sm:col-span-3 bg-sidebar p-3 sm:p-4 space-y-2">
                  <Logo variant="light" size="sm" className="mb-4 sm:mb-6" />
                  {["Dashboard", "Create Post", "Scheduled", "Analytics"].map((item, i) => (
                    <div key={item} className={`px-2 sm:px-3 py-2 rounded-md text-[10px] sm:text-xs font-medium truncate ${i === 0 ? "bg-sidebar-accent text-white" : "text-sidebar-foreground"}`}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="col-span-8 sm:col-span-9 p-3 sm:p-6 bg-background">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    {[
                      { label: "Pages", v: "4", icon: Globe },
                      { label: "Posts", v: "127", icon: Zap },
                      { label: "Scheduled", v: "23", icon: Calendar },
                      { label: "Reach", v: "342K", icon: BarChart3 },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-border p-3">
                        <s.icon className="h-4 w-4 text-primary mb-2" />
                        <div className="text-lg font-bold">{s.v}</div>
                        <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="text-xs font-semibold mb-3">Recent posts</div>
                    {["Dhaka Food Blog", "Travel Bangladesh", "Tech News BD"].map((p) => (
                      <div key={p} className="flex items-center justify-between py-2 border-t border-border first:border-t-0">
                        <span className="text-xs">{p}</span>
                        <Badge variant="secondary" className="text-[10px]">Published</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-24 container">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Everything you need to grow</h2>
          <p className="text-muted-foreground text-base sm:text-lg">Built for creators, marketers, and agencies who manage multiple Facebook Pages.</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="p-8 border-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-5 shadow-glow">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 bg-gradient-soft">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-base sm:text-lg">Start free. Upgrade when you grow.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((t) => (
              <Card
                key={t.name}
                className={`p-6 sm:p-8 relative ${t.highlight ? "border-primary shadow-elevated md:scale-105 bg-card" : "border-border"}`}
              >
                {t.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground border-0 px-3">
                    Most Popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold mb-1">{t.name}</h3>
                <p className="text-sm text-muted-foreground mb-5">{t.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold tracking-tight">{t.price}</span>
                  <span className="text-muted-foreground">{t.period}</span>
                </div>
                <Link to="/auth">
                  <Button className={`w-full mb-6 ${t.highlight ? "bg-gradient-primary hover:opacity-90 shadow-elevated" : ""}`} variant={t.highlight ? "default" : "outline"}>
                    {t.cta}
                  </Button>
                </Link>
                <ul className="space-y-3">
                  {t.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Logo />
              <p className="text-sm text-muted-foreground mt-4 max-w-xs">
                The all-in-one Facebook Page management tool for modern creators.
              </p>
            </div>
            {[
              { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "Cookies"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">© 2026 PageFlow. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Made with ♥ for creators worldwide.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
