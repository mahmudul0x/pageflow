import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Globe2,
  Layers,
  PenSquare,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildFacebookPostUrl } from "@/lib/utils";
import { pageService } from "@/services/pageService";
import { postService } from "@/services/postService";
import { useAppStore } from "@/store/useAppStore";

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    published: "bg-success/10 text-success border-success/20",
    scheduled: "bg-primary/10 text-primary border-primary/20",
    draft: "bg-muted text-muted-foreground border-border",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Badge variant="outline" className={`capitalize ${map[status]}`}>
      {status}
    </Badge>
  );
};

type StatCardProps = {
  icon: typeof Layers;
  label: string;
  value: string | number;
  change?: string;
};

const StatCard = ({ icon: Icon, label, value, change }: StatCardProps) => (
  <Card className="surface-panel rounded-[28px] border-none p-6 transition-transform duration-200 hover:-translate-y-0.5">
    <div className="mb-4 flex items-start justify-between">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      {change ? (
        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <ArrowUpRight className="h-3 w-3" /> {change}
        </span>
      ) : null}
    </div>
    <div className="mb-1 text-3xl font-bold tracking-tight">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </Card>
);

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PG";

const PublishActionButtons = ({
  results,
  compact = false,
}: {
  results?: Array<{ page: string; fbPostId?: string; error?: string }>;
  compact?: boolean;
}) => {
  const publishTargets = results?.filter((result) => result.fbPostId) ?? [];

  if (!publishTargets.length) {
    return <span className="text-xs text-muted-foreground">No live post link yet</span>;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "justify-start" : "justify-end"}`}>
      {publishTargets.map((result) => {
        const facebookPostUrl = buildFacebookPostUrl(result.fbPostId);
        if (!facebookPostUrl) return null;

        return (
          <Tooltip key={`${result.page}-${result.fbPostId}`}>
            <TooltipTrigger asChild>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl px-3">
                <a href={facebookPostUrl} target="_blank" rel="noreferrer" aria-label={`Open post for ${result.page}`}>
                  <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                    {getInitials(result.page)}
                  </span>
                  <span className={compact ? "sr-only" : "hidden xl:inline"}>{result.page}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs rounded-xl">
              <p className="font-medium">{result.page}</p>
              <p className="text-xs text-muted-foreground">Facebook ID: {result.fbPostId}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

const DashboardHome = () => {
  const user = useAppStore((s) => s.user);
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => postService.list() });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageFilter, setPageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const scheduled = posts.filter((post) => post.status === "scheduled").length;
  const published = posts.filter((post) => post.status === "published").length;
  const failed = posts.filter((post) => post.status === "failed").length;
  const totalReach = posts.reduce((sum, post) => sum + (post.reach ?? 0), 0);
  const successRate = posts.length ? Math.round((published / posts.length) * 100) : 0;
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (pageFilter !== "all" && !post.pageIds.includes(pageFilter)) return false;
      if (search.trim() && !post.content.toLowerCase().includes(search.trim().toLowerCase())) return false;

      const activityDate = new Date(post.scheduledFor ?? post.publishedAt ?? post.createdAt);
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (activityDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`);
        if (activityDate > to) return false;
      }
      return true;
    });
  }, [dateFrom, dateTo, pageFilter, posts, search, statusFilter]);
  const recentPosts = filteredPosts.slice(0, 5);
  const recentPublished = posts.find((post) => post.status === "published");
  const nextScheduled = [...posts]
    .filter((post) => post.status === "scheduled" && post.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];

  const copyFacebookId = async (fbPostId: string) => {
    try {
      await navigator.clipboard.writeText(fbPostId);
      toast.success(`Copied Facebook post ID: ${fbPostId}`);
    } catch {
      toast.error("Could not copy Facebook post ID.");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[32px] bg-gradient-hero px-6 py-7 text-white shadow-elevated sm:px-8 lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              Publishing overview
            </div>
            <h2 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {greeting}, {(user?.name || "there").split(" ")[0]}
            </h2>
            <p className="max-w-xl text-sm leading-6 text-white/78 sm:text-base">
              Track page activity, review the publishing queue, and move faster with a dashboard designed for focused daily work.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[430px]">
            <div className="rounded-3xl border border-white/16 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">Success rate</p>
              <p className="mt-2 text-3xl font-bold">{successRate}%</p>
            </div>
            <div className="rounded-3xl border border-white/16 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">Date</p>
              <p className="mt-2 text-lg font-semibold">{format(new Date(), "MMM d, yyyy")}</p>
            </div>
            <div className="rounded-3xl border border-white/16 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">Ready pages</p>
              <p className="mt-2 text-3xl font-bold">{pages.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="flex flex-col gap-4 rounded-[30px] border border-border/60 bg-card/70 p-6 shadow-soft md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Operations snapshot</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Today on PageFlow</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
          <Link to="/dashboard/create-post" className="w-full md:w-auto">
            <Button size="lg" className="w-full gap-2 rounded-2xl bg-gradient-primary px-6 shadow-elevated hover:opacity-90 md:w-auto">
              <PenSquare className="h-4 w-4" /> Create New Post
            </Button>
          </Link>
        </div>

        <Card className="surface-panel rounded-[30px] border-none p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Next up</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {nextScheduled ? format(new Date(nextScheduled.scheduledFor!), "MMM d, h:mm a") : "Nothing scheduled"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {nextScheduled ? nextScheduled.content : "Queue your next post to keep your pages active."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Layers} label="Pages Connected" value={pages.length} change={pages.length ? "Live" : undefined} />
        <StatCard icon={FileText} label="Published Posts" value={published} />
        <StatCard icon={Calendar} label="Scheduled Posts" value={scheduled} />
        <StatCard icon={TrendingUp} label="Total Reach" value={`${(totalReach / 1000).toFixed(1)}K`} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="surface-panel rounded-[28px] border-none p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latest published</p>
              <p className="mt-1 font-semibold text-foreground">
                {recentPublished ? recentPublished.pageNames.join(", ") : "No published posts yet"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {recentPublished ? recentPublished.content : "Publish your first post to see live activity here."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="surface-panel rounded-[28px] border-none p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Queue health</p>
              <p className="mt-1 font-semibold text-foreground">{scheduled} scheduled, {failed} failed</p>
              <p className="mt-1 text-sm text-muted-foreground">A quick overview of what needs attention before the next publish cycle.</p>
            </div>
          </div>
        </Card>

        <Card className="surface-panel rounded-[28px] border-none p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
              <Globe2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Workspace status</p>
              <p className="mt-1 font-semibold text-foreground">{pages.length ? "Pages connected and ready" : "Connect Facebook pages"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Each live post link is now grouped by page so multi-page publishing is easier to review.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="surface-panel rounded-[30px] border-none">
        <div className="flex items-center justify-between border-b border-border/60 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Recent activity</p>
            <h2 className="mt-1 text-xl font-semibold">Latest posts</h2>
            <p className="text-sm text-muted-foreground">Filter posts by status, page, date, or search text.</p>
          </div>
          <Link to="/dashboard/posts">
            <Button variant="outline" size="sm" className="rounded-xl">
              View all
            </Button>
          </Link>
        </div>

        <div className="grid gap-3 border-b border-border/60 p-6 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search post content"
              className="rounded-2xl pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-2xl border border-input bg-background px-3 text-sm">
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
            <option value="failed">Failed</option>
          </select>
          <select value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} className="h-10 rounded-2xl border border-input bg-background px-3 text-sm">
            <option value="all">All pages</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-2xl" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-2xl" />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Pages</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No posts matched the current dashboard filters.
                  </TableCell>
                </TableRow>
              ) : null}
              {recentPosts.map((post) => (
                <TableRow key={post.id} className="hover:bg-muted/30">
                  <TableCell className="min-w-[220px]">
                    <div className="flex flex-wrap gap-2">
                      {post.pageNames.length ? (
                        post.pageNames.map((name) => (
                          <Badge key={`${post.id}-${name}`} variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                            {name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No page</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm text-foreground">{post.content}</p>
                    {post.publishResults?.some((result) => result.fbPostId) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {post.publishResults
                          .filter((result) => result.fbPostId)
                          .map((result) => (
                            <div key={`${post.id}-${result.fbPostId}`} className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                              <span className="max-w-[180px] truncate">Facebook ID: {result.fbPostId}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyFacebookId(result.fbPostId!)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={post.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(post.scheduledFor ?? post.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell className="text-right">
                    <PublishActionButtons results={post.publishResults} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="divide-y divide-border md:hidden">
          {recentPosts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No posts matched the current dashboard filters.</div>
          ) : null}
          {recentPosts.map((post) => (
            <div key={post.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {post.pageNames.length ? (
                    post.pageNames.map((name) => (
                      <Badge key={`${post.id}-${name}`} variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                        {name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm font-semibold">No page</p>
                  )}
                </div>
                <StatusBadge status={post.status} />
              </div>
              <p className="line-clamp-2 text-sm text-foreground">{post.content}</p>
              {post.publishResults?.some((result) => result.fbPostId) ? (
                <div className="flex flex-col gap-1.5">
                  {post.publishResults
                    .filter((result) => result.fbPostId)
                    .map((result) => (
                      <div key={`${post.id}-${result.fbPostId}`} className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                        <span className="truncate">Facebook ID: {result.fbPostId}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyFacebookId(result.fbPostId!)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 pt-1">
                <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledFor ?? post.createdAt), "MMM d, h:mm a")}</span>
                <PublishActionButtons results={post.publishResults} compact />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardHome;
