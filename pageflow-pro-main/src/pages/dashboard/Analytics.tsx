import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  Facebook,
  Filter,
  Heart,
  LineChart,
  MessagesSquare,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildFacebookPostUrl, cn } from "@/lib/utils";
import { pageService } from "@/services/pageService";
import { analyticsService } from "@/services/analyticsService";

type AnalyticsPost = {
  postId?: string;
  name: string;
  content: string;
  mediaUrl?: string;
  status: string;
  mediaType: string;
  page: string;
  pageId?: string;
  fbPostId?: string;
  publishedAt?: string | null;
  reach: number;
  engagement: number;
  engagementRate: number;
};

type DashboardLayoutContext = {
  headerSearch: string;
};

const chartPalette = ["#0f766e", "#0891b2", "#2563eb", "#f97316", "#9333ea"];

const formatCompactMetric = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

const formatMetricCell = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "number") return value.toLocaleString();
  return value;
};

const formatPercent = (value?: number | null) => `${(value ?? 0).toFixed(1)}%`;

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeStatus = (status?: string) => {
  if (status === "failed") return "Failed";
  if (status === "scheduled") return "Scheduled";
  if (status === "draft") return "Draft";
  return "Published";
};

const normalizeMediaType = (mediaType?: string) => {
  if (mediaType === "image") return "Photo";
  if (mediaType === "video") return "Video";
  return "Text";
};

const statusClassName = (status?: string) => {
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "scheduled") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "draft") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const renderPostMediaPreview = (post: AnalyticsPost) => {
  if (!post.mediaUrl) return null;

  if (post.mediaType === "video") {
    return (
      <video
        src={post.mediaUrl}
        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  if (post.mediaType === "image") {
    return (
      <img
        src={post.mediaUrl}
        alt={post.name}
        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
        loading="lazy"
      />
    );
  }

  return null;
};

const Analytics = () => {
  const [pageId, setPageId] = useState("all");
  const [range, setRange] = useState("7");
  const [selectedPost, setSelectedPost] = useState<AnalyticsPost | null>(null);
  const { headerSearch } = useOutletContext<DashboardLayoutContext>();

  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: analytics, isLoading, isFetching } = useQuery({
    queryKey: ["analytics", pageId, range],
    queryFn: () => analyticsService.get({ page_id: pageId, date_range: range }),
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || !analytics) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <Card className="surface-panel rounded-[32px] border-none p-8 text-center text-sm text-muted-foreground">
          Loading live analytics...
        </Card>
      </div>
    );
  }

  const normalizedQuery = headerSearch.trim().toLowerCase();
  const filteredRows = analytics.individualPostAnalytics.filter((post: AnalyticsPost) => {
    if (!normalizedQuery) return true;
    const haystack = [post.name, post.content, post.fbPostId, post.postId, post.page].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const selectedPageName =
    pageId === "all" ? "All connected pages" : pages.find((page) => page.id === pageId)?.name ?? analytics.pageName;
  const summaryCards = [
    {
      label: "Total reach",
      value: formatCompactMetric(analytics.totalReach),
      tone: "from-teal-600 to-emerald-500",
      icon: Users,
      note: "Reached audience",
    },
    {
      label: "Media views",
      value: formatCompactMetric(analytics.impressions),
      tone: "from-sky-600 to-cyan-500",
      icon: Eye,
      note: "Insight views",
    },
    {
      label: "Engagement rate",
      value: formatPercent(analytics.engagementRate),
      tone: "from-blue-600 to-indigo-500",
      icon: Heart,
      note: "Engaged per reach",
    },
    {
      label: "Page follows",
      value: formatCompactMetric(analytics.pageLikes),
      tone: "from-orange-500 to-amber-500",
      icon: TrendingUp,
      note: "Follower total",
    },
  ];

  const postCount = filteredRows.length;
  const totalPostReach = filteredRows.reduce((sum: number, post: AnalyticsPost) => sum + (post.reach ?? 0), 0);
  const totalPostEngagement = filteredRows.reduce((sum: number, post: AnalyticsPost) => sum + (post.engagement ?? 0), 0);
  const averagePostReach = postCount ? totalPostReach / postCount : 0;
  const averagePostEngagement = postCount ? totalPostEngagement / postCount : 0;
  const averagePostRate = totalPostReach ? (totalPostEngagement / totalPostReach) * 100 : 0;
  const strongestPost = [...filteredRows].sort((a, b) => b.reach - a.reach)[0] ?? null;
  const latestPost = [...filteredRows].sort(
    (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
  )[0] ?? null;

  const postMix = [
    {
      name: "Reach",
      value: totalPostReach,
    },
    {
      name: "Engagement",
      value: totalPostEngagement,
    },
  ];

  const leaderboard = analytics.postPerformance.slice(0, 5).map((post: any) => ({
    name: post.name.length > 20 ? `${post.name.slice(0, 20)}...` : post.name,
    reach: post.reach,
    engagement: post.engagement,
  }));

  const selectedPostUrl = buildFacebookPostUrl(selectedPost?.fbPostId);
  const selectedPostBenchmarks = selectedPost
    ? [
        {
          metric: "Reach",
          post: selectedPost.reach,
          average: Number(averagePostReach.toFixed(0)),
        },
        {
          metric: "Engagement",
          post: selectedPost.engagement,
          average: Number(averagePostEngagement.toFixed(0)),
        },
        {
          metric: "Rate",
          post: Number(selectedPost.engagementRate.toFixed(1)),
          average: Number(averagePostRate.toFixed(1)),
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="surface-panel rounded-[20px] border-none p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                <p className="mt-1.5 text-xl font-bold tracking-tight">{card.value}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{card.note}</p>
              </div>
              <div className={cn("flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", card.tone)}>
                <card.icon className="h-3.5 w-3.5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="surface-panel mt-6 rounded-[28px] border-none p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)]">
            <div>
              <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Page filter
              </label>
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger className="h-11 rounded-xl bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Date window</label>
              <Tabs value={range} onValueChange={setRange}>
                <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-slate-100 p-1">
                  <TabsTrigger value="7" className="rounded-lg text-xs">7 days</TabsTrigger>
                  <TabsTrigger value="30" className="rounded-lg text-xs">30 days</TabsTrigger>
                  <TabsTrigger value="90" className="rounded-lg text-xs">90 days</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="xl:w-[460px]">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Posts</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{postCount}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Avg. reach</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCompactMetric(Math.round(averagePostReach))}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Avg. rate</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatPercent(averagePostRate)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {analytics.error ? (
        <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{analytics.error}</div>
      ) : null}

      {!analytics.error && analytics.warning ? (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{analytics.warning}</div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="surface-panel rounded-[24px] border-none p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Strongest post</p>
              <div className="mt-2 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">
                  {strongestPost?.name ?? "No live data yet"}
                </p>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-teal-100 text-teal-700">
              <MessagesSquare className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[16px] border border-slate-200/80 bg-white/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reach</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatMetricCell(strongestPost?.reach)}</p>
            </div>
            <div className="rounded-[16px] border border-slate-200/80 bg-white/80 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rate</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatPercent(strongestPost?.engagementRate)}</p>
            </div>
          </div>
        </Card>

        <Card className="surface-panel rounded-[24px] border-none p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest post</p>
              <div className="mt-2 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="line-clamp-1 text-sm font-semibold leading-5 text-foreground">
                  {latestPost?.name ?? "No recent post found"}
                </p>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-blue-100 text-blue-700">
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2.5 rounded-[16px] border border-slate-200/80 bg-white/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Published</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatShortDateTime(latestPost?.publishedAt)}</p>
          </div>
        </Card>
      </div>

      <Card className="surface-panel mt-8 rounded-[32px] border-none">
        <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-semibold">Post explorer</h3>
              <p className="text-sm text-muted-foreground">
                {pageId === "all"
                  ? "Browse published posts across all active pages. Click a row to open the post detail panel."
                  : `Showing live post metrics for ${selectedPageName}. Click a row for more details.`}
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageId === "all" ? "All pages view" : "Single page view"}
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="min-w-[360px]">Post</TableHead>
                <TableHead className="min-w-[160px]">Published</TableHead>
                <TableHead className="min-w-[130px]">Status</TableHead>
                <TableHead className="min-w-[160px]">Page</TableHead>
                <TableHead className="text-right">Reach</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length ? (
                filteredRows.map((post: AnalyticsPost) => {
                  const url = buildFacebookPostUrl(post.fbPostId);
                  return (
                    <TableRow
                      key={`${post.postId}-${post.page}-${post.fbPostId ?? "none"}`}
                      className="cursor-pointer border-slate-200/90 transition hover:bg-slate-50/70"
                      onClick={() => setSelectedPost(post)}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-start gap-3">
                          {renderPostMediaPreview(post)}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700">
                                {normalizeMediaType(post.mediaType)}
                              </Badge>
                              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">ID: {post.fbPostId || post.postId || "--"}</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{post.name}</p>
                              <p className="line-clamp-2 max-w-[320px] text-xs leading-5 text-slate-500">{post.content}</p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{formatShortDateTime(post.publishedAt)}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", statusClassName(post.status))}>
                          {normalizeStatus(post.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          <Facebook className="h-3.5 w-3.5 text-blue-600" />
                          {post.page}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatMetricCell(post.reach)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatMetricCell(post.engagement)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatPercent(post.engagementRate)}</TableCell>
                      <TableCell className="text-right">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                          >
                            View live <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No link</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-500">
                    No post-level analytics matched the current page, date range, and search filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4 p-5 xl:hidden">
          {filteredRows.length ? (
            filteredRows.map((post: AnalyticsPost) => (
              <Card
                key={`${post.postId}-${post.page}-${post.fbPostId ?? "none"}`}
                className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm"
                onClick={() => setSelectedPost(post)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-start gap-3">
                      {renderPostMediaPreview(post)}
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700">
                            {normalizeMediaType(post.mediaType)}
                          </Badge>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{post.page}</span>
                        </div>
                        <p className="font-semibold text-slate-900">{post.name}</p>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">{post.content}</p>
                      </div>
                    </div>
                  </div>
                  <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", statusClassName(post.status))}>
                    {normalizeStatus(post.status)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reach</p>
                    <p className="mt-2 font-semibold">{formatMetricCell(post.reach)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Engagement</p>
                    <p className="mt-2 font-semibold">{formatMetricCell(post.engagement)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rate</p>
                    <p className="mt-2 font-semibold">{formatPercent(post.engagementRate)}</p>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No post-level analytics matched the current page, date range, and search filters.
            </div>
          )}
        </div>
      </Card>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-panel rounded-[32px] border-none p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Reach and media views over time</h3>
              <p className="text-sm text-muted-foreground">Daily page performance trend for the selected scope.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={analytics.reachOverTime}>
              <defs>
                <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="viewGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid rgba(226,232,240,1)",
                  boxShadow: "0 20px 40px -24px rgba(15,23,42,0.28)",
                }}
              />
              <Area type="monotone" dataKey="reach" stroke="#0f766e" strokeWidth={3} fill="url(#reachGradient)" />
              <Area type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2.5} fill="url(#viewGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid gap-6">
          <Card className="surface-panel rounded-[32px] border-none p-6">
            <div className="mb-5">
              <h3 className="font-semibold">Top post leaderboard</h3>
              <p className="text-sm text-muted-foreground">Highest-performing posts by reach and engagement.</p>
            </div>
            {leaderboard.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leaderboard}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      borderRadius: "16px",
                      border: "1px solid rgba(226,232,240,1)",
                    }}
                  />
                  <Bar dataKey="reach" fill="#0f766e" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="engagement" fill="#2563eb" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 text-sm text-slate-500">
                No post leaderboard data is available yet.
              </div>
            )}
          </Card>

          <Card className="surface-panel rounded-[32px] border-none p-6">
            <div className="mb-5">
              <h3 className="font-semibold">Post outcome mix</h3>
              <p className="text-sm text-muted-foreground">A quick split between total post reach and total interactions.</p>
            </div>
            {postMix.some((item) => item.value > 0) ? (
              <div className="grid items-center gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={postMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={4}>
                      {postMix.map((entry, index) => (
                        <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {postMix.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{formatCompactMetric(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[190px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 text-sm text-slate-500">
                Post mix will appear once reach or interaction data is available.
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => (!open ? setSelectedPost(null) : null)}>
        <DialogContent className="max-h-[90vh] max-w-[1180px] overflow-y-auto rounded-[30px] border border-slate-200 bg-white p-0">
          {selectedPost ? (
            <div className="overflow-hidden rounded-[30px]">
              <div className="bg-[linear-gradient(135deg,#eff6ff_0%,#ecfeff_48%,#ffffff_100%)] px-6 py-6 sm:px-8">
                <DialogHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full bg-blue-100 text-blue-700">
                      {normalizeMediaType(selectedPost.mediaType)}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                      {selectedPost.page}
                    </Badge>
                    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", statusClassName(selectedPost.status))}>
                      {normalizeStatus(selectedPost.status)}
                    </span>
                  </div>
                  <DialogTitle className="max-w-4xl text-2xl font-bold tracking-tight text-slate-950">{selectedPost.name}</DialogTitle>
                  <DialogDescription className="max-w-4xl text-sm leading-6 text-slate-600">
                    {selectedPost.content}
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="rounded-full bg-white/85 px-3 py-1.5 shadow-sm">Published: {formatShortDateTime(selectedPost.publishedAt)}</span>
                  <span className="rounded-full bg-white/85 px-3 py-1.5 shadow-sm">Post ID: {selectedPost.fbPostId || selectedPost.postId || "--"}</span>
                  {selectedPostUrl ? (
                    <a
                      href={selectedPostUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 font-medium text-white"
                    >
                      Open live post <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 shadow-none">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reach</p>
                          <p className="mt-1 text-2xl font-bold text-slate-950">{formatMetricCell(selectedPost.reach)}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 shadow-none">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                          <Heart className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Engagement</p>
                          <p className="mt-1 text-2xl font-bold text-slate-950">{formatMetricCell(selectedPost.engagement)}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 shadow-none">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                          <LineChart className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Engagement rate</p>
                          <p className="mt-1 text-2xl font-bold text-slate-950">{formatPercent(selectedPost.engagementRate)}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 shadow-none">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                          <Facebook className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Page</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">{selectedPost.page}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="rounded-[28px] border border-slate-200 p-5 shadow-none">
                    <h4 className="font-semibold text-slate-900">Post detail snapshot</h4>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                        <p className="mt-2 font-semibold text-slate-900">{normalizeStatus(selectedPost.status)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Media type</p>
                        <p className="mt-2 font-semibold text-slate-900">{normalizeMediaType(selectedPost.mediaType)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Published</p>
                        <p className="mt-2 font-semibold text-slate-900">{formatShortDateTime(selectedPost.publishedAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reference</p>
                        <p className="mt-2 truncate font-semibold text-slate-900">{selectedPost.fbPostId || selectedPost.postId || "--"}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="rounded-[28px] border border-slate-200 p-5 shadow-none">
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-900">Post vs explorer average</h4>
                      <p className="text-sm text-muted-foreground">Compare the selected post with the average visible post in the current analytics table.</p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={selectedPostBenchmarks}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                        <XAxis dataKey="metric" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            background: "#ffffff",
                            borderRadius: "16px",
                            border: "1px solid rgba(226,232,240,1)",
                          }}
                        />
                        <Bar dataKey="post" name="Selected post" fill="#0f766e" radius={[10, 10, 0, 0]} />
                        <Bar dataKey="average" name="Explorer average" fill="#cbd5e1" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="rounded-[28px] border border-slate-200 p-5 shadow-none">
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-900">Performance composition</h4>
                      <p className="text-sm text-muted-foreground">A simple visual balance between reach, engagement, and rate for this selected post.</p>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={[
                          { name: "Reach", value: selectedPost.reach },
                          { name: "Engagement", value: selectedPost.engagement },
                          { name: "Rate", value: Number(selectedPost.engagementRate.toFixed(1)) },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            background: "#ffffff",
                            borderRadius: "16px",
                            border: "1px solid rgba(226,232,240,1)",
                          }}
                        />
                        <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                          <Cell fill="#0f766e" />
                          <Cell fill="#2563eb" />
                          <Cell fill="#f97316" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;
