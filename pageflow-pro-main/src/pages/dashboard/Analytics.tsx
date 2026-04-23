import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, BarChart2, Eye, Heart, TrendingUp, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildFacebookPostUrl } from "@/lib/utils";
import { pageService } from "@/services/pageService";
import { analyticsService } from "@/services/analyticsService";

type StatCardProps = {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  change: string;
};

const StatCard = ({ icon: Icon, label, value, change }: StatCardProps) => (
  <Card className="surface-panel rounded-[28px] border-none p-6">
    <div className="mb-4 flex items-start justify-between">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <ArrowUpRight className="h-3 w-3" /> {change}
      </span>
    </div>
    <div className="mb-1 text-3xl font-bold tracking-tight">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </Card>
);

const formatMetricValue = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

const Analytics = () => {
  const [pageId, setPageId] = useState("all");
  const [range, setRange] = useState("7");
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: analytics, isLoading, isFetching } = useQuery({
    queryKey: ["analytics", pageId, range],
    queryFn: () => analyticsService.get({ page_id: pageId, date_range: range }),
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || !analytics) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <Card className="surface-panel rounded-[30px] border-none p-8 text-center text-sm text-muted-foreground">
          Loading live analytics...
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <Card className="surface-panel rounded-[28px] border-none p-5">
            <Activity className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Active page scope</p>
            <p className="mt-2 text-lg font-semibold">{pageId === "all" ? "All connected pages" : pages.find((page) => page.id === pageId)?.name ?? "Selected page"}</p>
          </Card>
          <Card className="surface-panel rounded-[28px] border-none p-5">
            <BarChart2 className="mb-3 h-5 w-5 text-accent" />
            <p className="text-sm text-muted-foreground">Analysis window</p>
            <p className="mt-2 text-lg font-semibold">Last {range} days</p>
          </Card>
        </div>
      </section>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Performance dashboard</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h2>
          <p className="text-muted-foreground">
            Track performance across your pages
            {isFetching ? " | Refreshing live data..." : analytics.pageName ? ` | ${analytics.pageName}` : ""}
          </p>
        </div>
        <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
          <Select value={pageId} onValueChange={setPageId}>
            <SelectTrigger className="w-full rounded-xl bg-white/80 sm:w-[220px]">
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
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="w-full rounded-2xl bg-white/80 p-1 sm:w-auto">
              <TabsTrigger value="7" className="flex-1 sm:flex-initial">7 days</TabsTrigger>
              <TabsTrigger value="30" className="flex-1 sm:flex-initial">30 days</TabsTrigger>
              <TabsTrigger value="90" className="flex-1 sm:flex-initial">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {analytics.error ? (
        <Card className="mb-8 rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {analytics.error}
        </Card>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Total Reach" value={formatMetricValue(analytics.totalReach)} change="Live" />
        <StatCard icon={Eye} label="Impressions" value={formatMetricValue(analytics.impressions)} change="Live" />
        <StatCard icon={Users} label="Page Likes" value={formatMetricValue(analytics.pageLikes)} change="Live" />
        <StatCard icon={Heart} label="Engagement Rate" value={`${analytics.engagementRate}%`} change="Live" />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="surface-panel rounded-[30px] border-none p-6">
          <h3 className="mb-1 font-semibold">Reach over time</h3>
          <p className="mb-4 text-sm text-muted-foreground">Daily reach and impressions</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics.reachOverTime}>
              <defs>
                <linearGradient id="reach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="reach" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#reach)" />
              <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary-glow))" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="surface-panel rounded-[30px] border-none p-6">
          <h3 className="mb-1 font-semibold">Top posts performance</h3>
          <p className="mb-4 text-sm text-muted-foreground">Best-performing posts in the selected range</p>
          {analytics.postPerformance.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.postPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="reach" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="engagement" fill="hsl(var(--primary-glow))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground">
              No post-level performance data is available for this range yet.
            </div>
          )}
        </Card>
      </div>

      <Card className="surface-panel rounded-[30px] border-none">
        <div className="border-b border-border/60 p-6">
          <h3 className="font-semibold">Top performing posts</h3>
          <p className="text-sm text-muted-foreground">Sorted by total reach</p>
        </div>
        {analytics.postPerformance.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.postPerformance.map((post: any) => (
                    <TableRow key={post.name}>
                      <TableCell className="font-medium">{post.name}</TableCell>
                      <TableCell className="text-right">{post.reach.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{post.engagement.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{post.reach ? ((post.engagement / post.reach) * 100).toFixed(1) : "0.0"}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {analytics.postPerformance.map((post: any) => (
                <div key={post.name} className="space-y-2 p-4">
                  <p className="text-sm font-medium">{post.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Reach</p>
                      <p className="font-semibold text-foreground">{post.reach.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Engagement</p>
                      <p className="font-semibold text-foreground">{post.engagement.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-semibold text-foreground">{post.reach ? ((post.engagement / post.reach) * 100).toFixed(1) : "0.0"}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">No post-level analytics to show for the selected page and date range.</div>
        )}
      </Card>

      <Card className="surface-panel mt-8 rounded-[30px] border-none">
        <div className="border-b border-border/60 p-6">
          <h3 className="font-semibold">Individual Post Analytics</h3>
          <p className="text-sm text-muted-foreground">Live metrics for each published post in the selected range</p>
        </div>
        {analytics.individualPostAnalytics.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Post</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.individualPostAnalytics.map((post: any) => {
                    const url = buildFacebookPostUrl(post.fbPostId);
                    return (
                      <TableRow key={`${post.postId}-${post.page}-${post.fbPostId ?? "none"}`}>
                        <TableCell className="max-w-md">
                          <p className="font-medium">{post.name}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{post.content}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{post.page}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{post.reach.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{post.engagement.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{post.engagementRate.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                              Open <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">No link</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-border lg:hidden">
              {analytics.individualPostAnalytics.map((post: any) => {
                const url = buildFacebookPostUrl(post.fbPostId);
                return (
                  <div key={`${post.postId}-${post.page}-${post.fbPostId ?? "none"}`} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{post.name}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{post.content}</p>
                      </div>
                      <Badge variant="secondary">{post.page}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Reach</p>
                        <p className="font-semibold">{post.reach.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Engagement</p>
                        <p className="font-semibold">{post.engagement.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate</p>
                        <p className="font-semibold">{post.engagementRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        Open live post <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">No individual post analytics are available for the selected filters yet.</div>
        )}
      </Card>
    </div>
  );
};

export default Analytics;
