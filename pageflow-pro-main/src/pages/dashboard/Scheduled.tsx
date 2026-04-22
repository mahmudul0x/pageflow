import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Edit2, Trash2, Calendar as CalIcon, ArrowUpRight, Copy } from "lucide-react";
import { postService } from "@/services/postService";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isSameMonth } from "date-fns";
import { toast } from "sonner";
import { buildFacebookPostUrl, cn } from "@/lib/utils";

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    published: "bg-success/10 text-success border-success/20",
    scheduled: "bg-primary/10 text-primary border-primary/20",
    draft: "bg-muted text-muted-foreground border-border",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return <Badge variant="outline" className={`capitalize ${map[status]}`}>{status}</Badge>;
};

const Scheduled = () => {
  const qc = useQueryClient();
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: postService.list });
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const all = eachDayOfInterval({ start, end });
    const padStart = getDay(start);
    return { all, padStart };
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    posts.forEach((p) => {
      const d = p.scheduledFor ?? p.createdAt;
      const key = format(new Date(d), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [posts]);

  const handleDelete = async (id: string) => {
    await postService.remove(id);
    toast.success("Post deleted");
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  const sorted = [...posts].sort((a, b) =>
    new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime()
  );

  const copyFacebookId = async (fbPostId: string) => {
    try {
      await navigator.clipboard.writeText(fbPostId);
      toast.success(`Copied Facebook post ID: ${fbPostId}`);
    } catch {
      toast.error("Could not copy Facebook post ID.");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto pt-20 lg:pt-10 pb-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Scheduled Posts</h1>
        <p className="text-muted-foreground">Plan, review, and manage your content calendar</p>
      </div>

      {/* Calendar */}
      <Card className="p-3 sm:p-6 border-border mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="py-2"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span></div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: days.padStart }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.all.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={key}
                className={cn(
                  "aspect-square sm:aspect-auto sm:min-h-[80px] p-1 sm:p-2 rounded-lg border border-border flex flex-col text-left transition-colors hover:bg-muted/50",
                  isToday && "border-primary bg-primary/5",
                  !isSameMonth(day, cursor) && "opacity-40"
                )}
              >
                <span className={cn("text-xs sm:text-sm font-semibold", isToday && "text-primary")}>{format(day, "d")}</span>
                <div className="flex flex-wrap gap-1 mt-auto">
                  {dayPosts.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.status === "scheduled" && "bg-primary",
                        p.status === "published" && "bg-success",
                        p.status === "failed" && "bg-destructive",
                        p.status === "draft" && "bg-muted-foreground"
                      )}
                    />
                  ))}
                  {dayPosts.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayPosts.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* List */}
      <div className="pb-8">
        <h2 className="text-lg font-semibold mb-4">All Posts ({sorted.length})</h2>
        <div className="space-y-3">
          {sorted.map((post) => (
            <Card key={post.id} className="p-4 sm:p-5 border-border hover:shadow-card transition-shadow">
              {(() => {
                const firstFacebookPostId = post.publishResults?.find((result) => result.fbPostId)?.fbPostId;
                const facebookPostUrl = buildFacebookPostUrl(firstFacebookPostId);
                return (
                  <>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <StatusBadge status={post.status} />
                  {post.pageNames.map((n) => (
                    <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                  ))}
                </div>
                <p className="text-sm text-foreground line-clamp-2 mb-2">{post.content}</p>
                {post.publishResults?.length ? (
                  <div className="flex flex-col gap-1 mb-2">
                    {post.publishResults.map((result) => (
                      <div key={`${post.id}-${result.page}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>
                          {result.page}: {result.fbPostId ? `Facebook ID ${result.fbPostId}` : result.error || "No Facebook result"}
                        </span>
                        {result.fbPostId ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => copyFacebookId(result.fbPostId!)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{format(new Date(post.scheduledFor ?? post.createdAt), "MMM d, yyyy · h:mm a")}</span>
                  </div>
                </div>
                <div className="flex gap-2 md:flex-shrink-0">
                  {facebookPostUrl ? (
                    <Button asChild size="sm" variant="outline" className="gap-1.5 flex-1 md:flex-initial">
                      <a href={facebookPostUrl} target="_blank" rel="noreferrer">
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="gap-1.5 flex-1 md:flex-initial">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(post.id)} className="gap-1.5 text-destructive hover:text-destructive flex-1 md:flex-initial">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
                  </>
                );
              })()}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Scheduled;
