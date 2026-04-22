import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Eye, Heart, Users, ArrowUpRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from "recharts";
import { pageService } from "@/services/pageService";
import { analyticsService } from "@/services/analyticsService";

const StatCard = ({ icon: Icon, label, value, change }: any) => (
  <Card className="p-6 border-border">
    <div className="flex items-start justify-between mb-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-xs font-medium text-success flex items-center gap-0.5">
        <ArrowUpRight className="h-3 w-3" /> {change}
      </span>
    </div>
    <div className="text-3xl font-bold tracking-tight mb-1">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </Card>
);

const Analytics = () => {
  const [pageId, setPageId] = useState("all");
  const [range, setRange] = useState("7");
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: a } = useQuery({
    queryKey: ["analytics", pageId, range],
    queryFn: () => analyticsService.get({ page_id: pageId, date_range: range }),
  });

  if (!a) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto pt-20 lg:pt-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Analytics</h1>
          <p className="text-muted-foreground">Track performance across your pages</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Select value={pageId} onValueChange={setPageId}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pages</SelectItem>
              {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="7" className="flex-1 sm:flex-initial">7 days</TabsTrigger>
              <TabsTrigger value="30" className="flex-1 sm:flex-initial">30 days</TabsTrigger>
              <TabsTrigger value="90" className="flex-1 sm:flex-initial">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp} label="Total Reach" value={`${(a.totalReach / 1000).toFixed(1)}K`} change="+12.5%" />
        <StatCard icon={Eye} label="Impressions" value={`${(a.impressions / 1000).toFixed(1)}K`} change="+8.3%" />
        <StatCard icon={Users} label="Page Likes" value={`${(a.pageLikes / 1000).toFixed(1)}K`} change="+4.1%" />
        <StatCard icon={Heart} label="Engagement Rate" value={`${a.engagementRate}%`} change="+1.2%" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6 border-border">
          <h3 className="font-semibold mb-1">Reach over time</h3>
          <p className="text-sm text-muted-foreground mb-4">Daily reach and impressions</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={a.reachOverTime}>
              <defs>
                <linearGradient id="reach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Area type="monotone" dataKey="reach" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#reach)" />
              <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary-glow))" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 border-border">
          <h3 className="font-semibold mb-1">Top posts performance</h3>
          <p className="text-sm text-muted-foreground mb-4">Reach vs engagement</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={a.postPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="reach" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="engagement" fill="hsl(var(--primary-glow))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="border-border mb-8">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold">Top performing posts</h3>
          <p className="text-sm text-muted-foreground">Sorted by total reach</p>
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
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
            {a.postPerformance.map((p: any) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right">{p.reach.toLocaleString()}</TableCell>
                <TableCell className="text-right">{p.engagement.toLocaleString()}</TableCell>
                <TableCell className="text-right">{((p.engagement / p.reach) * 100).toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {/* Mobile stacked cards */}
        <div className="md:hidden divide-y divide-border">
          {a.postPerformance.map((p: any) => (
            <div key={p.name} className="p-4 space-y-2">
              <p className="font-medium text-sm">{p.name}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Reach</p>
                  <p className="font-semibold text-foreground">{p.reach.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Engagement</p>
                  <p className="font-semibold text-foreground">{p.engagement.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rate</p>
                  <p className="font-semibold text-foreground">{((p.engagement / p.reach) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Analytics;
