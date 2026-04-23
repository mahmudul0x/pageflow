import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { ArrowUpRight, Calendar as CalIcon, CalendarRange, ChevronLeft, ChevronRight, Clock3, Copy, Edit2, Rows3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildFacebookPostUrl, cn } from "@/lib/utils";
import { postService } from "@/services/postService";
import type { Post } from "@/lib/mockData";

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

const Scheduled = () => {
  const qc = useQueryClient();
  const { data: posts = [] } = useQuery({ queryKey: ["posts", "scheduled"], queryFn: () => postService.list("scheduled") });
  const [cursor, setCursor] = useState(new Date());
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editScheduledTime, setEditScheduledTime] = useState("");

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const all = eachDayOfInterval({ start, end });
    const padStart = getDay(start);
    return { all, padStart };
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach((post) => {
      const date = post.scheduledFor ?? post.createdAt;
      const key = format(new Date(date), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    });
    return map;
  }, [posts]);

  const sorted = [...posts].sort(
    (a, b) => new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime()
  );
  const upcoming = sorted.filter((post) => new Date(post.scheduledFor ?? post.createdAt).getTime() >= Date.now()).length;
  const busyDays = postsByDay.size;
  const maxDailyVolume = Math.max(0, ...Array.from(postsByDay.values()).map((items) => items.length));

  const handleDelete = async (id: string) => {
    try {
      await postService.remove(id);
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (error: any) {
      const details = error?.response?.data?.details;
      const message = error?.response?.data?.error || "Could not delete the post.";
      toast.error(Array.isArray(details) && details.length ? `${message} ${details.join(" | ")}` : message);
    }
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditScheduledTime(post.scheduledFor ? post.scheduledFor.slice(0, 16) : "");
  };

  const closeEdit = () => {
    setEditingPost(null);
    setEditContent("");
    setEditScheduledTime("");
  };

  const handleSave = async () => {
    if (!editingPost) return;

    try {
      await postService.update(editingPost.id, {
        content: editContent,
        scheduled_time: editScheduledTime,
      });
      toast.success("Scheduled post updated");
      closeEdit();
      await qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not update the scheduled post.");
    }
  };

  const copyFacebookId = async (fbPostId: string) => {
    try {
      await navigator.clipboard.writeText(fbPostId);
      toast.success(`Copied Facebook post ID: ${fbPostId}`);
    } catch {
      toast.error("Could not copy Facebook post ID.");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-3">
          <Card className="surface-panel rounded-[28px] border-none p-5">
            <Clock3 className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Upcoming posts</p>
            <p className="mt-2 text-3xl font-bold">{upcoming}</p>
          </Card>
          <Card className="surface-panel rounded-[28px] border-none p-5">
            <Rows3 className="mb-3 h-5 w-5 text-accent" />
            <p className="text-sm text-muted-foreground">Queued entries</p>
            <p className="mt-2 text-3xl font-bold">{sorted.length}</p>
          </Card>
          <Card className="surface-panel rounded-[28px] border-none p-5">
            <CalendarRange className="mb-3 h-5 w-5 text-success" />
            <p className="text-sm text-muted-foreground">Current month</p>
            <p className="mt-2 text-3xl font-bold">{format(cursor, "MMM")}</p>
          </Card>
        </div>
      </section>

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Content calendar</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Scheduled Posts</h2>
        <p className="text-muted-foreground">Plan, review, and manage your content calendar</p>
      </div>

      <Card className="surface-panel mb-8 rounded-[30px] border-none p-3 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">{format(cursor, "MMMM yyyy")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hover any highlighted date to preview the scheduled posts and destination pages for that day.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" className="rounded-xl" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button size="icon" variant="outline" className="rounded-xl" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Busy days</p>
            <p className="mt-2 text-2xl font-bold">{busyDays}</p>
            <p className="mt-1 text-sm text-muted-foreground">Dates in this queue with at least one scheduled post.</p>
          </div>
          <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Peak load</p>
            <p className="mt-2 text-2xl font-bold">{maxDailyVolume}</p>
            <p className="mt-1 text-sm text-muted-foreground">Highest number of scheduled posts on a single date.</p>
          </div>
          <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Legend</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Scheduled day</Badge>
              <Badge variant="outline" className="border-success/20 bg-success/10 text-success">Today</Badge>
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="py-2">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: days.padStart }).map((_, index) => (
            <div key={`pad-${index}`} />
          ))}
          {days.all.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = isSameDay(day, new Date());
            const hasPosts = dayPosts.length > 0;
            const dayCell = (
              <div
                className={cn(
                  "group aspect-square rounded-[24px] border border-border/70 bg-white/70 p-2 text-left transition-all hover:-translate-y-0.5 hover:bg-secondary/50 sm:aspect-auto sm:min-h-[118px] sm:p-3",
                  isToday && "border-success/30 bg-success/5",
                  hasPosts && "border-primary/25 bg-primary/[0.05] shadow-soft",
                  !isSameMonth(day, cursor) && "opacity-40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-xs font-semibold sm:text-sm", isToday && "text-success", hasPosts && !isToday && "text-primary")}>
                    {format(day, "d")}
                  </span>
                  {hasPosts ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {dayPosts.length}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 hidden space-y-1 sm:block">
                  {dayPosts.slice(0, 2).map((post) => (
                    <div key={post.id} className="rounded-xl bg-background/80 px-2 py-1 text-[11px] leading-4 text-foreground">
                      <p className="truncate font-medium">{format(new Date(post.scheduledFor ?? post.createdAt), "h:mm a")}</p>
                      <p className="truncate text-muted-foreground">{post.pageNames.join(", ")}</p>
                    </div>
                  ))}
                  {dayPosts.length > 2 ? <p className="text-[11px] font-medium text-primary">+{dayPosts.length - 2} more scheduled</p> : null}
                </div>

                {hasPosts ? (
                  <div className="mt-auto flex flex-wrap gap-1 pt-2 sm:pt-3">
                    {dayPosts.slice(0, 4).map((post) => (
                      <span key={post.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ))}
                    {dayPosts.length > 4 ? <span className="text-[10px] text-muted-foreground">+{dayPosts.length - 4}</span> : null}
                  </div>
                ) : null}
              </div>
            );

            if (!hasPosts) {
              return <div key={key}>{dayCell}</div>;
            }

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div>{dayCell}</div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm rounded-2xl p-0">
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold text-foreground">{format(day, "EEEE, MMMM d")}</p>
                      <p className="text-xs text-muted-foreground">{dayPosts.length} scheduled post{dayPosts.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="space-y-2">
                      {dayPosts.map((post) => (
                        <div key={post.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <StatusBadge status={post.status} />
                            <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledFor ?? post.createdAt), "h:mm a")}</span>
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {post.pageNames.map((name) => (
                              <Badge key={`${post.id}-${name}`} variant="secondary" className="text-[10px]">
                                {name}
                              </Badge>
                            ))}
                          </div>
                          <p className="line-clamp-2 text-xs text-foreground">{post.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </Card>

      <div className="pb-8">
        <h2 className="mb-4 text-lg font-semibold">All Posts ({sorted.length})</h2>
        <div className="space-y-3">
          {sorted.map((post) => (
            <Card key={post.id} className="surface-panel rounded-[28px] border-none p-4 transition-shadow sm:p-5">
              {(() => {
                const firstFacebookPostId = post.publishResults?.find((result) => result.fbPostId)?.fbPostId;
                const facebookPostUrl = buildFacebookPostUrl(firstFacebookPostId);

                return (
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={post.status} />
                        {post.pageNames.map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                      <p className="mb-2 line-clamp-2 text-sm text-foreground">{post.content}</p>
                      {post.publishResults?.length ? (
                        <div className="mb-2 flex flex-col gap-1">
                          {post.publishResults.map((result) => (
                            <div key={`${post.id}-${result.page}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>{result.page}: {result.fbPostId ? `Facebook ID ${result.fbPostId}` : result.error || "No Facebook result"}</span>
                              {result.fbPostId ? (
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyFacebookId(result.fbPostId!)}>
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
                        <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5 rounded-xl md:flex-initial">
                          <a href={facebookPostUrl} target="_blank" rel="noreferrer">
                            Open <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl md:flex-initial"
                        onClick={() => openEdit(post)}
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 gap-1.5 rounded-xl text-destructive hover:text-destructive md:flex-initial"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(editingPost)} onOpenChange={(open) => (open ? null : closeEdit())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[28px] p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="scheduled-post-content">Content</Label>
              <Textarea
                id="scheduled-post-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[180px] rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-post-time">Scheduled time</Label>
              <Input
                id="scheduled-post-time"
                type="datetime-local"
                value={editScheduledTime}
                onChange={(e) => setEditScheduledTime(e.target.value)}
                className="rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={closeEdit} className="w-full rounded-xl sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} className="w-full rounded-xl bg-gradient-primary sm:w-auto">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Scheduled;
