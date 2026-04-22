import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ArrowUpRight, Calendar, Copy, FileText, Layers, MoreHorizontal, PenSquare, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  return <Badge variant="outline" className={`capitalize ${map[status]}`}>{status}</Badge>;
};

const StatCard = ({ icon: Icon, label, value, change }: any) => (
  <Card className="p-6 border-border hover:shadow-card transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      {change && (
        <span className="text-xs font-medium text-success flex items-center gap-0.5">
          <ArrowUpRight className="h-3 w-3" /> {change}
        </span>
      )}
    </div>
    <div className="text-3xl font-bold tracking-tight mb-1">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </Card>
);

const DashboardHome = () => {
  const user = useAppStore((s) => s.user);
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: postService.list });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const scheduled = posts.filter((post) => post.status === "scheduled").length;
  const published = posts.filter((post) => post.status === "published").length;
  const totalReach = posts.reduce((sum, post) => sum + (post.reach ?? 0), 0);

  const copyFacebookId = async (fbPostId: string) => {
    try {
      await navigator.clipboard.writeText(fbPostId);
      toast.success(`Copied Facebook post ID: ${fbPostId}`);
    } catch {
      toast.error("Could not copy Facebook post ID.");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto pt-20 lg:pt-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1">
            {greeting}, {(user?.name || "there").split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Link to="/dashboard/create-post" className="w-full md:w-auto">
          <Button size="lg" className="w-full md:w-auto bg-gradient-primary hover:opacity-90 shadow-elevated gap-2">
            <PenSquare className="h-4 w-4" /> Create New Post
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Layers} label="Pages Connected" value={pages.length} change={pages.length ? "Live data" : undefined} />
        <StatCard icon={FileText} label="Published Posts" value={published} />
        <StatCard icon={Calendar} label="Scheduled Posts" value={scheduled} />
        <StatCard icon={TrendingUp} label="Total Reach" value={`${(totalReach / 1000).toFixed(1)}K`} />
      </div>

      <Card className="border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Recent Posts</h2>
            <p className="text-sm text-muted-foreground">Your latest activity across all pages</p>
          </div>
          <Link to="/dashboard/scheduled">
            <Button variant="outline" size="sm">View all</Button>
          </Link>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Page</TableHead>
                <TableHead>Post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.slice(0, 5).map((post) => (
                <TableRow key={post.id} className="hover:bg-muted/30">
                  {(() => {
                    const firstFacebookPostId = post.publishResults?.find((result) => result.fbPostId)?.fbPostId;
                    const facebookPostUrl = buildFacebookPostUrl(firstFacebookPostId);
                    return (
                      <>
                  <TableCell className="font-medium whitespace-nowrap">
                    {post.pageNames.slice(0, 1).join(", ") || "No page"}
                    {post.pageNames.length > 1 && (
                      <span className="text-muted-foreground ml-1">+{post.pageNames.length - 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="truncate text-sm text-muted-foreground">{post.content}</p>
                    {post.publishResults?.some((result) => result.fbPostId) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {post.publishResults
                          .filter((result) => result.fbPostId)
                          .map((result) => (
                            <div key={`${post.id}-${result.fbPostId}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="truncate">Facebook ID: {result.fbPostId}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyFacebookId(result.fbPostId!)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={post.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(post.scheduledFor ?? post.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell className="text-right">
                    {facebookPostUrl ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={facebookPostUrl} target="_blank" rel="noreferrer">
                          Open <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                      </>
                    );
                  })()}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden divide-y divide-border">
          {posts.slice(0, 5).map((post) => (
            <div key={post.id} className="p-4 space-y-2">
              {(() => {
                const firstFacebookPostId = post.publishResults?.find((result) => result.fbPostId)?.fbPostId;
                const facebookPostUrl = buildFacebookPostUrl(firstFacebookPostId);
                return (
                  <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold truncate">
                  {post.pageNames.slice(0, 1).join(", ") || "No page"}
                  {post.pageNames.length > 1 && (
                    <span className="text-muted-foreground font-normal ml-1">+{post.pageNames.length - 1}</span>
                  )}
                </p>
                <StatusBadge status={post.status} />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
              {post.publishResults?.some((result) => result.fbPostId) && (
                <div className="flex flex-col gap-1">
                  {post.publishResults
                    .filter((result) => result.fbPostId)
                    .map((result) => (
                      <div key={`${post.id}-${result.fbPostId}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Facebook ID: {result.fbPostId}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyFacebookId(result.fbPostId!)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(post.scheduledFor ?? post.createdAt), "MMM d, h:mm a")}
                </span>
                {facebookPostUrl ? (
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={facebookPostUrl} target="_blank" rel="noreferrer">
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                )}
              </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardHome;
