import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowUpRight, Calendar, EyeOff, FileSearch, Filter, PencilLine, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildFacebookPostUrl } from "@/lib/utils";
import { pageService } from "@/services/pageService";
import { postService } from "@/services/postService";
import type { Post } from "@/lib/mockData";

const statusOptions = ["all", "published", "scheduled", "draft", "failed"] as const;

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    published: "bg-success/10 text-success border-success/20",
    scheduled: "bg-primary/10 text-primary border-primary/20",
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Badge variant="outline" className={`capitalize ${map[status]}`}>
      {status}
    </Badge>
  );
};

const AllPosts = () => {
  const qc = useQueryClient();
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editScheduledTime, setEditScheduledTime] = useState("");
  const [editPageIds, setEditPageIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<"save" | "schedule" | "publish" | null>(null);
  const [quickActionPostId, setQuickActionPostId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      page_ids: selectedPageIds.length ? selectedPageIds : undefined,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      include_hidden: showHidden || undefined,
    }),
    [dateFrom, dateTo, search, selectedPageIds, showHidden, status]
  );

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", "all-posts", filters],
    queryFn: () => postService.list(filters),
  });

  const visiblePosts = showHidden ? posts : posts.filter((post) => !post.hidden);

  const togglePageFilter = (pageId: string) => {
    setSelectedPageIds((current) => (current.includes(pageId) ? current.filter((item) => item !== pageId) : [...current, pageId]));
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditScheduledTime(post.scheduledFor ? post.scheduledFor.slice(0, 16) : "");
    setEditPageIds(post.pageIds);
  };

  const closeEdit = () => {
    setEditingPost(null);
    setEditContent("");
    setEditScheduledTime("");
    setEditPageIds([]);
    setActionLoading(null);
  };

  const refreshPosts = async () => {
    await qc.invalidateQueries({ queryKey: ["posts"] });
  };

  const handleSave = async () => {
    if (!editingPost) return;

    try {
      setActionLoading("save");
      await postService.update(editingPost.id, {
        content: editContent,
        scheduled_time: editingPost.status === "scheduled" ? editScheduledTime : undefined,
        page_ids: editPageIds,
      });
      toast.success(editingPost.status === "draft" ? "Draft updated" : "Post updated");
      closeEdit();
      await refreshPosts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not update the post.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleScheduleDraft = async () => {
    if (!editingPost) return;
    if (!editScheduledTime) {
      toast.error("Pick a scheduled time first.");
      return;
    }

    try {
      setActionLoading("schedule");
      await postService.update(editingPost.id, {
        content: editContent,
        page_ids: editPageIds,
      });
      await postService.scheduleExisting(editingPost.id, editScheduledTime);
      toast.success("Draft scheduled successfully");
      closeEdit();
      await refreshPosts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not schedule the draft.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishDraft = async () => {
    if (!editingPost) return;

    try {
      setActionLoading("publish");
      await postService.update(editingPost.id, {
        content: editContent,
        page_ids: editPageIds,
      });
      const response = await postService.publishExisting(editingPost.id);
      const successPages = response.results
        .filter((result: any) => result.success)
        .map((result: any) => (result.fb_post_id ? `${result.page} (${result.fb_post_id})` : result.page));
      const failedPages = response.results
        .filter((result: any) => !result.success)
        .map((result: any) => `${result.page}: ${result.error || "Unknown error"}`);

      toast.success(successPages.length ? `Published successfully: ${successPages.join(", ")}` : response.message);
      if (failedPages.length) {
        toast.error(`Failed pages: ${failedPages.join(" | ")}`);
      }
      closeEdit();
      await refreshPosts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not publish the draft.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickPublishDraft = async (post: Post) => {
    try {
      setQuickActionPostId(post.id);
      const response = await postService.publishExisting(post.id);
      const successPages = response.results
        .filter((result: any) => result.success)
        .map((result: any) => (result.fb_post_id ? `${result.page} (${result.fb_post_id})` : result.page));
      const failedPages = response.results
        .filter((result: any) => !result.success)
        .map((result: any) => `${result.page}: ${result.error || "Unknown error"}`);

      toast.success(successPages.length ? `Published successfully: ${successPages.join(", ")}` : response.message);
      if (failedPages.length) {
        toast.error(`Failed pages: ${failedPages.join(" | ")}`);
      }
      await refreshPosts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not publish the draft.");
    } finally {
      setQuickActionPostId(null);
    }
  };

  const handleOpenDraftScheduler = (post: Post) => {
    openEdit(post);
    setEditScheduledTime(post.scheduledFor ? post.scheduledFor.slice(0, 16) : "");
  };

  const handleHideToggle = async (post: Post) => {
    try {
      await postService.update(post.id, { hidden: !post.hidden });
      toast.success(post.hidden ? "Post restored to the list." : "Post hidden from the main list.");
      await refreshPosts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not update visibility.");
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await postService.remove(postId);
      toast.success("Post deleted");
      await refreshPosts();
    } catch (error: any) {
      const details = error?.response?.data?.details;
      const message = error?.response?.data?.error || "Could not delete the post.";
      toast.error(Array.isArray(details) && details.length ? `${message} ${details.join(" | ")}` : message);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[32px] bg-gradient-hero px-6 py-7 text-white shadow-elevated sm:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Post management</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">See all posts and manage them page by page.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
          Filter by specific pages, review published and scheduled content, then edit, hide, or delete posts from one clean workspace.
        </p>
      </section>

      <Card className="surface-panel mb-8 rounded-[30px] border-none p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Filter className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filters</p>
            <h2 className="text-xl font-semibold">Find the exact posts you need</h2>
          </div>
        </div>

        <div className="mb-5 grid gap-3 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search post content" className="rounded-2xl pl-10" />
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-2xl" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-2xl" />
          <Button
            variant={showHidden ? "default" : "outline"}
            className="rounded-2xl"
            onClick={() => setShowHidden((current) => !current)}
          >
            {showHidden ? "Showing hidden too" : "Show hidden posts"}
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option}
              variant={status === option ? "default" : "outline"}
              size="sm"
              className="rounded-full capitalize"
              onClick={() => setStatus(option)}
            >
              {option}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {pages.map((page) => (
            <Button
              key={page.id}
              variant={selectedPageIds.includes(page.id) ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => togglePageFilter(page.id)}
            >
              {page.name}
            </Button>
          ))}
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Results</p>
          <h2 className="text-xl font-semibold">All Posts ({visiblePosts.length})</h2>
        </div>
        {(selectedPageIds.length || search || dateFrom || dateTo || status !== "all") && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setSelectedPageIds([]);
              setStatus("all");
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Reset filters
          </Button>
        )}
      </div>

      <div className="space-y-4 pb-8">
        {isLoading ? (
          <Card className="surface-panel rounded-[28px] border-none p-6 text-sm text-muted-foreground">Loading posts...</Card>
        ) : null}

        {!isLoading && visiblePosts.length === 0 ? (
          <Card className="surface-panel rounded-[28px] border-none p-8 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No posts found</h3>
            <p className="mt-2 text-sm text-muted-foreground">Try different page, status, or date filters to broaden the result.</p>
          </Card>
        ) : null}

        {visiblePosts.map((post) => {
          const firstFacebookPostId = post.publishResults?.find((result) => result.fbPostId)?.fbPostId;
          const facebookPostUrl = buildFacebookPostUrl(firstFacebookPostId);
          const canEdit = post.status !== "published";
          const isDraft = post.status === "draft";
          const isQuickActionLoading = quickActionPostId === post.id;

          return (
            <Card key={post.id} className="surface-panel rounded-[28px] border-none p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={post.status} />
                    {isDraft ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-100/80 text-amber-800">
                        Needs action
                      </Badge>
                    ) : null}
                    {post.hidden ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Hidden</Badge> : null}
                    {post.pageNames.map((name) => (
                      <Badge key={`${post.id}-${name}`} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                  {isDraft ? (
                    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>Draft saved. Review the content, then publish it now or schedule it for later.</span>
                    </div>
                  ) : null}
                  <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{post.content}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Created: {format(new Date(post.createdAt), "MMM d, yyyy · h:mm a")}</span>
                    {post.scheduledFor ? <span>Scheduled: {format(new Date(post.scheduledFor), "MMM d, yyyy · h:mm a")}</span> : null}
                    {post.publishedAt ? <span>Published: {format(new Date(post.publishedAt), "MMM d, yyyy · h:mm a")}</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
                  {facebookPostUrl ? (
                    <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl">
                      <a href={facebookPostUrl} target="_blank" rel="noreferrer">
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl"
                    onClick={() => openEdit(post)}
                    disabled={!canEdit}
                  >
                    <PencilLine className="h-3.5 w-3.5" /> {isDraft ? "Continue draft" : canEdit ? "Edit" : "Published"}
                  </Button>
                  {isDraft ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-xl"
                      onClick={() => handleOpenDraftScheduler(post)}
                      disabled={isQuickActionLoading}
                    >
                      <Calendar className="h-3.5 w-3.5" /> Schedule
                    </Button>
                  ) : null}
                  {isDraft ? (
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl bg-gradient-primary hover:opacity-90"
                      onClick={() => handleQuickPublishDraft(post)}
                      disabled={isQuickActionLoading}
                    >
                      <Send className="h-3.5 w-3.5" /> {isQuickActionLoading ? "Publishing..." : "Publish now"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => handleHideToggle(post)}>
                    <EyeOff className="h-3.5 w-3.5" /> {post.hidden ? "Unhide" : "Hide"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-destructive hover:text-destructive" onClick={() => handleDelete(post.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(editingPost)} onOpenChange={(open) => (open ? null : closeEdit())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[28px] p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingPost?.status === "draft" ? "Continue Draft" : "Edit Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {editingPost?.status === "draft" ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>Save your progress, schedule this draft, or publish it immediately from this modal.</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="post-content">Content</Label>
              <Textarea
                id="post-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[180px] rounded-2xl"
              />
            </div>

            {editingPost?.status === "scheduled" || editingPost?.status === "draft" ? (
              <div className="space-y-2">
                <Label htmlFor="scheduled-time">Scheduled time</Label>
                <Input
                  id="scheduled-time"
                  type="datetime-local"
                  value={editScheduledTime}
                  onChange={(e) => setEditScheduledTime(e.target.value)}
                  className="rounded-2xl"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Pages</Label>
              <div className="flex flex-wrap gap-2">
                {pages.map((page) => (
                  <Button
                    key={page.id}
                    type="button"
                    size="sm"
                    variant={editPageIds.includes(page.id) ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() =>
                      setEditPageIds((current) =>
                        current.includes(page.id) ? current.filter((item) => item !== page.id) : [...current, page.id]
                      )
                    }
                  >
                    {page.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={closeEdit} className="w-full rounded-xl sm:w-auto">
              Cancel
            </Button>
            {editingPost?.status === "draft" ? (
              <Button
                variant="outline"
                onClick={handleScheduleDraft}
                disabled={actionLoading !== null}
                className="w-full rounded-xl sm:w-auto"
              >
                <Calendar className="mr-2 h-4 w-4" /> Schedule
              </Button>
            ) : null}
            <Button
              onClick={handleSave}
              disabled={actionLoading !== null}
              className="w-full rounded-xl bg-gradient-primary sm:w-auto"
            >
              Save changes
            </Button>
            {editingPost?.status === "draft" ? (
              <Button
                onClick={handlePublishDraft}
                disabled={actionLoading !== null}
                className="w-full rounded-xl bg-gradient-primary sm:w-auto"
              >
                <Send className="mr-2 h-4 w-4" /> Publish now
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllPosts;
