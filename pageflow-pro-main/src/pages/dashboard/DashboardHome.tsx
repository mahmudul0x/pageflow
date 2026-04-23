import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildFacebookPostUrl } from "@/lib/utils";
import { pageService } from "@/services/pageService";
import { postService } from "@/services/postService";
import { useAppStore } from "@/store/useAppStore";

const formatCompactMetric = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    published: "border-emerald-200 bg-emerald-50 text-emerald-700",
    scheduled: "border-sky-200 bg-sky-50 text-sky-700",
    draft: "border-amber-200 bg-amber-50 text-amber-700",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <Badge variant="outline" className={`capitalize rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status] || ""}`}>
      {status}
    </Badge>
  );
};

type StatCardProps = {
  icon: typeof Layers;
  label: string;
  value: string | number;
  note: string;
  tone: string;
};

const StatCard = ({ icon: Icon, label, value, note, tone }: StatCardProps) => (
  <Card className="surface-panel rounded-[26px] border-none overflow-hidden">
    <CardContent className="relative p-0">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone}`} />
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PG";

const getActivityTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return format(date, "MMM d, h:mm a");
};

const renderPostMediaPreview = (post: {
  mediaUrl?: string | null;
  mediaType?: string | null;
  content: string;
}) => {
  if (!post.mediaUrl) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        No media
      </div>
    );
  }

  if (post.mediaType === "video") {
    return (
      <video
        src={post.mediaUrl}
        className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <img
      src={post.mediaUrl}
      alt={post.content.slice(0, 40) || "Post media"}
      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
      loading="lazy"
    />
  );
};

const getStatusTone = (status: string) => {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "scheduled") return "bg-sky-50 text-sky-700";
  if (status === "draft") return "bg-amber-50 text-amber-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const PublishActionButtons = ({
  results,
  compact = false,
}: {
  results?: Array<{ page: string; fbPostId?: string; error?: string }>;
  compact?: boolean;
}) => {
  const publishTargets = results?.filter((result) => result.fbPostId) ?? [];

  if (!publishTargets.length) {
    return <span className="text-xs text-slate-400">No live link</span>;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "justify-start" : "justify-end"}`}>
      {publishTargets.map((result) => {
        const facebookPostUrl = buildFacebookPostUrl(result.fbPostId);
        if (!facebookPostUrl) return null;

        return (
          <Tooltip key={`${result.page}-${result.fbPostId}`}>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                className="h-8 rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-medium text-sky-700 shadow-none hover:bg-sky-100"
              >
                <a href={facebookPostUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-sky-700">
                    {getInitials(result.page)}
                  </span>
                  {!compact && <span className="max-w-[110px] truncate">{result.page}</span>}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{result.page}: {result.fbPostId}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

const DashboardHome = () => {
  const [searchParams] = useSearchParams();
  const user = useAppStore((state) => state.user);
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => postService.list() });
  const search = searchParams.get("q") || "";
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageFilter, setPageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const scheduled = posts.filter((post) => post.status === "scheduled").length;
  const published = posts.filter((post) => post.status === "published").length;
  const draft = posts.filter((post) => post.status === "draft").length;
  const totalReach = posts.reduce((sum, post) => sum + (post.reach ?? 0), 0);

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

  const recentPosts = filteredPosts.slice(0, 8);
  const nextScheduled = [...posts]
    .filter((post) => post.status === "scheduled" && post.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())[0];
  const latestPublished = [...posts]
    .filter((post) => post.status === "published")
    .sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime())[0];
  const copyFacebookId = async (fbPostId: string) => {
    try {
      await navigator.clipboard.writeText(fbPostId);
      toast.success("Copied");
    } catch {
      toast.error("Failed");
    }
  };

  const summaryCards = [
    {
      icon: Layers,
      label: "Connected Pages",
      value: pages.length,
      note: pages.length ? "Ready for publishing" : "Connect a page to begin",
      tone: "from-cyan-600 to-sky-500",
    },
    {
      icon: FileText,
      label: "Published Posts",
      value: published,
      note: "Live content across your pages",
      tone: "from-emerald-600 to-teal-500",
    },
    {
      icon: Calendar,
      label: "Scheduled Queue",
      value: scheduled,
      note: "Posts waiting to go live",
      tone: "from-blue-600 to-indigo-500",
    },
    {
      icon: TrendingUp,
      label: "Estimated Reach",
      value: formatCompactMetric(totalReach),
      note: "Combined post reach so far",
      tone: "from-orange-500 to-amber-500",
    },
  ];

  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-hero px-4 py-4 text-white shadow-elevated sm:px-5 sm:py-5 lg:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_26%)]" />
        <div className="relative space-y-3">
          <div className="rounded-[24px] border border-white/14 bg-white/10 p-3.5 backdrop-blur-md sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Welcome back</p>
                <h1 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl lg:text-[1.6rem]">
                  {firstName}, your dashboard is ready.
                </h1>
                <p className="mt-1.5 max-w-xl text-sm leading-5 text-white/78">
                  Keep track of your latest publishing activity and manage posts faster from one place.
                </p>
              </div>
              <Link to="/dashboard/create-post">
                <Button size="sm" className="h-9 gap-2 rounded-xl bg-white px-3.5 text-slate-950 shadow-lg hover:bg-white/90">
                  <PenSquare className="h-3.5 w-3.5" />
                  New post
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[20px] border border-white/14 bg-white/10 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Drafts</p>
                  <p className="mt-0.5 text-lg font-bold text-white">{draft}</p>
                </div>
                <div className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-medium text-white/80">Review queue</div>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/14 bg-white/10 p-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Next publish</p>
              <p className="mt-1 text-sm font-semibold text-white">{getActivityTime(nextScheduled?.scheduledFor)}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/72">
                {nextScheduled?.content || "No scheduled post in queue right now."}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/14 bg-white/10 p-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Latest live</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">
                {latestPublished?.pageNames?.[0] || "No live post yet"}
              </p>
              <p className="mt-0.5 text-[11px] text-white/72">{getActivityTime(latestPublished?.publishedAt ?? latestPublished?.createdAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} note={card.note} tone={card.tone} />
        ))}
      </div>

      <Card className="surface-panel mt-8 overflow-hidden rounded-[32px] border-none">
        <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Recent posts</h2>
              <p className="mt-1 text-sm text-slate-500">Filter posts by status, page, and date while keeping quick access to live Facebook links.</p>
            </div>
            <Link to="/dashboard/posts">
              <Button variant="outline" size="sm" className="rounded-xl bg-white/90">
                View all posts
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200/70 bg-white/70 p-4 lg:grid-cols-4 lg:p-5">
          <div className="rounded-[22px] border border-slate-200 bg-white p-3">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Filter by status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All status</option>
              <option value="published">Published only</option>
              <option value="scheduled">Scheduled only</option>
              <option value="draft">Draft only</option>
              <option value="failed">Failed only</option>
            </select>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Filter by page
            </label>
            <select
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="all">All pages</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              From date
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-3">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              To date
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 rounded-2xl border-slate-200 bg-white"
            />
          </div>
        </div>

        <div className="hidden space-y-3 bg-white/55 p-4 xl:block">
          {recentPosts.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-12 text-center text-sm text-slate-500">
              No posts matched the current dashboard filters.
            </div>
          ) : null}

          {recentPosts.map((post) => (
            <div
              key={post.id}
              className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="shrink-0">
                    {renderPostMediaPreview(post)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {post.pageNames.length ? (
                        post.pageNames.map((name) => (
                          <div
                            key={`${post.id}-${name}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-slate-500">
                              {getInitials(name)}
                            </span>
                            <span className="max-w-[130px] truncate">{name}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No page</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{post.content}</p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Published: {getActivityTime(post.scheduledFor ?? post.publishedAt ?? post.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end justify-center gap-3 self-stretch">
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(post.status)}`}>
                    {post.status}
                  </div>
                  <div className="flex items-center justify-end">
                    <PublishActionButtons results={post.publishResults} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 bg-white/55 p-4 xl:hidden">
          {recentPosts.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No posts matched the current dashboard filters.
            </div>
          ) : null}

          {recentPosts.map((post) => (
            <Card key={post.id} className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="shrink-0">
                    {renderPostMediaPreview(post)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {post.pageNames.length ? (
                        post.pageNames.map((name) => (
                          <div
                            key={`${post.id}-${name}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-slate-500">
                              {getInitials(name)}
                            </span>
                            <span className="max-w-[110px] truncate">{name}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No page</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{post.content}</p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Published: {getActivityTime(post.scheduledFor ?? post.publishedAt ?? post.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-center gap-3 self-stretch">
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusTone(post.status)}`}>
                    {post.status}
                  </div>
                  <PublishActionButtons results={post.publishResults} compact />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardHome;
