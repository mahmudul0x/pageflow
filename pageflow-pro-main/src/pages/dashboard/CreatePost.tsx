import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Eye, EyeOff, Image as ImageIcon, Link2, MessageCircle, MoreHorizontal, Send, Share2, Smile, Save, ThumbsUp, Type, UploadCloud, Video, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { authService } from "@/services/authService";
import { pageService } from "@/services/pageService";
import { postService } from "@/services/postService";

const EMOJIS = ["😀", "😍", "🔥", "🎉", "❤️", "👏", "🙌", "💯", "✨", "🚀", "🌟", "👍", "🥰", "😎", "🤩", "💪"];

const CreatePost = () => {
  const queryClient = useQueryClient();
  const { data: pages = [] } = useQuery({ queryKey: ["pages"], queryFn: pageService.list });
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"text" | "image" | "video">("text");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [publishProgressOpen, setPublishProgressOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [serverProgress, setServerProgress] = useState(0);
  const [publishStage, setPublishStage] = useState("Preparing upload");
  const [publishMessage, setPublishMessage] = useState("Getting everything ready.");
  const [publishStatus, setPublishStatus] = useState<"idle" | "uploading" | "publishing" | "completed" | "failed">("idle");
  const progressIntervalRef = useRef<number | null>(null);

  const clearProgressPolling = () => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => () => clearProgressPolling(), []);

  const allSelected = pages.length > 0 && selectedPages.length === pages.length;
  const togglePage = (id: string) =>
    setSelectedPages((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleAll = () => setSelectedPages(allSelected ? [] : pages.map((page) => page.id));

  const previewPage = pages.find((page) => page.id === selectedPages[0]) ?? pages[0];

  const handleFile = (file: File, targetType: "image" | "video") => {
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);
    setPostType(targetType);
    setMediaUrlInput("");
  };

  const applyMediaUrl = () => {
    const trimmed = mediaUrlInput.trim();
    if (!trimmed) {
      toast.error(`Add a ${postType} URL first.`);
      return;
    }

    setMediaFile(null);
    setMediaUrl(trimmed);
  };

  const validate = () => {
    if (selectedPages.length === 0) return toast.error("Select at least one page."), false;
    if (!content.trim()) return toast.error("Write something to post."), false;
    if (postType === "video" && !mediaUrl?.trim() && !mediaFile) return toast.error("Add a video file or public video URL before publishing."), false;
    if (postType === "image" && !mediaUrl && !mediaFile) return toast.error("Add an image file or image URL first."), false;
    return true;
  };

  const requestPostingPermission = async () => {
    try {
      setPermissionLoading(true);
      const data = await authService.getFacebookUrl("posting");
      window.location.href = data.auth_url;
    } catch (error: any) {
      setPermissionLoading(false);
      toast.error(error?.response?.data?.error || "Could not start Facebook posting permission.");
    }
  };

  const startPublishProgress = (sessionId: string) => {
    clearProgressPolling();
    progressIntervalRef.current = window.setInterval(async () => {
      try {
        const progress = await postService.getPublishProgress(sessionId);
        setServerProgress(progress.progress);
        setPublishStage(progress.stage || "Publishing");
        setPublishMessage(progress.message || "Publishing your content.");
        setPublishStatus(progress.status === "failed" ? "failed" : progress.status === "completed" ? "completed" : "publishing");

        if (progress.status === "completed" || progress.status === "failed") {
          clearProgressPolling();
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          clearProgressPolling();
        }
      }
    }, 800);
  };

  const publishNow = async () => {
    if (!validate()) return;

    const shouldTrackProgress = postType === "video";
    const publishSessionId = shouldTrackProgress ? crypto.randomUUID() : undefined;

    try {
      if (shouldTrackProgress) {
        setPublishProgressOpen(true);
        setUploadProgress(0);
        setServerProgress(0);
        setPublishStage("Uploading to server");
        setPublishMessage("Starting video upload.");
        setPublishStatus("uploading");
        startPublishProgress(publishSessionId!);
      }

      const response = await postService.publish({
        page_ids: selectedPages,
        content,
        media_url: mediaFile ? undefined : mediaUrl ?? undefined,
        media_type: postType === "text" ? undefined : postType,
        file: mediaFile ?? undefined,
        publish_session_id: publishSessionId,
      }, shouldTrackProgress ? {
        onUploadProgress: (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
          setPublishStage("Uploading to server");
          setPublishMessage(`Uploading video from your device: ${percent}%`);
          setPublishStatus("uploading");
        },
      } : undefined);
      await queryClient.invalidateQueries({ queryKey: ["posts"] });

      const successPages = response.results
        .filter((result) => result.success)
        .map((result) => (result.fb_post_id ? `${result.page} (${result.fb_post_id})` : result.page));
      const failedPages = response.results
        .filter((result) => !result.success)
        .map((result) => `${result.page}: ${result.error || "Unknown error"}`);

      toast.success(successPages.length ? `Published successfully: ${successPages.join(", ")}` : response.message);

      if (failedPages.length) {
        toast.error(`Failed pages: ${failedPages.join(" | ")}`);
      }

      if (shouldTrackProgress) {
        setServerProgress(100);
        setPublishStage("Completed");
        setPublishMessage("Video published successfully.");
        setPublishStatus("completed");
        window.setTimeout(() => setPublishProgressOpen(false), 900);
      }

      setContent("");
      setSelectedPages([]);
      setMediaUrl(null);
      setMediaUrlInput("");
      setMediaFile(null);
      setPostType("text");
    } catch (error: any) {
      if (shouldTrackProgress) {
        setPublishStatus("failed");
        setPublishStage("Failed");
        setPublishMessage(error?.response?.data?.error || "Could not publish the video.");
      }
      toast.error(error?.response?.data?.error || "Could not publish. If needed, enable Facebook posting permission first.");
    } finally {
      window.setTimeout(() => clearProgressPolling(), 1200);
    }
  };

  const saveDraft = async () => {
    if (!content.trim()) {
      toast.error("Write something before saving a draft.");
      return;
    }
    if (mediaFile) {
      toast.error("Draft save for uploaded files is not supported yet. Use an external media URL or publish directly.");
      return;
    }

    try {
      setDraftLoading(true);
      await postService.saveDraft({
        page_ids: selectedPages,
        content,
        media_url: mediaFile ? undefined : mediaUrl ?? undefined,
        media_type: postType === "text" ? undefined : postType,
      });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Draft saved successfully.");
      setContent("");
      setSelectedPages([]);
      setMediaUrl(null);
      setMediaUrlInput("");
      setMediaFile(null);
      setPostType("text");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not save the draft.");
    } finally {
      setDraftLoading(false);
    }
  };

  const schedulePost = async () => {
    if (!validate()) return;
    if (!scheduleDate || !scheduleTime) return toast.error("Pick date and time.");
    if (mediaFile) return toast.error("Image scheduling is not supported yet. Please use Publish Now for image posts.");

    try {
      await postService.schedule({
        page_ids: selectedPages,
        content,
        media_url: mediaUrl ?? undefined,
        media_type: postType === "text" ? undefined : postType,
        scheduled_time: `${scheduleDate}T${scheduleTime}`,
      });
      toast.success("Post scheduled successfully.");
      setScheduleOpen(false);
      setContent("");
      setSelectedPages([]);
      setMediaUrl(null);
      setMediaUrlInput("");
      setMediaFile(null);
      setPostType("text");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not schedule the post.");
    }
  };

  const previewCard = (
    <Card className="surface-panel overflow-hidden rounded-[30px] border-none bg-card">
      <div className="flex items-start gap-3 p-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-lg text-white">
          {previewPage?.avatar ?? "P"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{previewPage?.name ?? "Your Page"}</p>
          <p className="text-xs text-muted-foreground">Just now · Public</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="px-5 pb-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content || <span className="italic text-muted-foreground">Your post will appear here...</span>}
        </p>
      </div>
      {mediaUrl ? (
        <div className="bg-muted">
          {postType === "video" ? (
            <video src={mediaUrl} controls className="max-h-96 w-full bg-black object-cover" />
          ) : (
            <img src={mediaUrl} alt="preview" className="max-h-96 w-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
        <span>1.2K reactions</span>
        <span>234 comments · 56 shares</span>
      </div>
      <div className="flex items-center justify-around border-t border-border/60 px-3 py-2">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map((action) => (
          <button key={action.label} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted">
            <action.icon className="h-4 w-4" /> {action.label}
          </button>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 pb-44 sm:px-6 sm:pb-40 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Publishing flow</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Create Post</h2>
          <p className="text-muted-foreground">Compose and publish to multiple pages at once</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={requestPostingPermission} disabled={permissionLoading}>
            {permissionLoading ? "Opening Facebook..." : "Enable Facebook Posting"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl lg:hidden"
            onClick={() => setMobilePreviewOpen((current) => !current)}
          >
            {mobilePreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {mobilePreviewOpen ? "Hide" : "Show"} preview
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {mobilePreviewOpen ? (
          <div className="lg:hidden">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</h3>
            {previewCard}
          </div>
        ) : null}

        <div className="space-y-6 lg:col-span-3">
          <Card className="surface-panel rounded-[30px] border-none p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Select Pages</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="select-all" className="text-sm text-muted-foreground">
                  Select all
                </Label>
                <Switch id="select-all" checked={allSelected} onCheckedChange={toggleAll} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pages.map((page) => {
                const checked = selectedPages.includes(page.id);
                return (
                  <label
                    key={page.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-[24px] border p-4 transition-all ${
                      checked ? "border-primary bg-primary/8 shadow-soft" : "border-border/70 bg-secondary/30 hover:border-primary/30"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => togglePage(page.id)} />
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-lg text-white">
                      {page.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{page.name}</p>
                      <p className="text-xs text-muted-foreground">{(page.followers / 1000).toFixed(1)}K followers</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card className="surface-panel rounded-[30px] border-none p-4 sm:p-6">
            <Tabs
              value={postType}
              onValueChange={(value) => {
                const nextType = value as "text" | "image" | "video";
                setPostType(nextType);
                if (nextType === "text") {
                  setMediaUrl(null);
                  setMediaUrlInput("");
                  setMediaFile(null);
                } else if (nextType === "video") {
                  setMediaFile(null);
                  if (mediaUrl && mediaFile) {
                    setMediaUrl(null);
                  }
                }
              }}
              className="mb-4"
            >
              <TabsList className="w-full rounded-2xl bg-secondary/80 p-1 sm:w-auto">
                <TabsTrigger value="text" className="flex-1 gap-2 sm:flex-initial">
                  <Type className="h-4 w-4" /> Text
                </TabsTrigger>
                <TabsTrigger value="image" className="flex-1 gap-2 sm:flex-initial">
                  <ImageIcon className="h-4 w-4" /> Image
                </TabsTrigger>
                <TabsTrigger value="video" className="flex-1 gap-2 sm:flex-initial">
                  <Video className="h-4 w-4" /> Video
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] resize-none rounded-[24px] border-border/70 bg-secondary/35 px-5 py-4 text-base focus-visible:ring-primary"
                maxLength={2000}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="relative">
                  <Button variant="ghost" size="sm" onClick={() => setShowEmoji((current) => !current)} className="gap-1.5">
                    <Smile className="h-4 w-4" /> Emoji
                  </Button>
                  {showEmoji ? (
                    <div className="absolute bottom-full left-0 z-10 mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-border bg-popover p-2 shadow-elevated">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setContent((current) => current + emoji);
                            setShowEmoji(false);
                          }}
                          className="h-8 w-8 rounded text-lg transition hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className={`text-xs ${content.length > 1800 ? "text-destructive" : "text-muted-foreground"}`}>
                  {content.length} / 2000
                </span>
              </div>
            </div>

            {postType !== "text" ? (
              <div className="mt-4">
                {mediaUrl ? (
                  <div className="relative overflow-hidden rounded-[24px] border border-border">
                    {postType === "video" ? (
                      <video src={mediaUrl} controls className="max-h-80 w-full bg-black object-cover" />
                    ) : (
                      <img src={mediaUrl} alt="upload preview" className="max-h-80 w-full object-cover" />
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute right-2 top-2 h-8 w-8"
                      onClick={() => {
                        setMediaUrl(null);
                        setMediaUrlInput("");
                        setMediaFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : postType === "image" ? (
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-border bg-secondary/25 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 sm:p-10"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file, "image");
                    }}
                  >
                    <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop your image here, or tap to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground">PNG or JPG up to 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file, "image");
                      }}
                      />
                  </label>
                ) : postType === "video" ? (
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-border bg-secondary/25 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 sm:p-10"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file, "video");
                    }}
                  >
                    <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop your video here, or tap to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground">MP4 or other supported video formats up to 1.5GB</p>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file, "video");
                      }}
                    />
                  </label>
                ) : null}

                {postType !== "text" ? (
                  <div className="mt-4 rounded-[24px] border border-border/70 bg-secondary/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Link2 className="h-4 w-4 text-primary" />
                      Public {postType} URL
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        value={mediaUrlInput}
                        onChange={(e) => setMediaUrlInput(e.target.value)}
                        placeholder={postType === "video" ? "https://cdn.example.com/video.mp4" : "https://images.example.com/photo.jpg"}
                        className="rounded-2xl"
                      />
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={applyMediaUrl}>
                        Use URL
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {postType === "video"
                        ? "Upload a video file directly or use a direct public video URL. Large files automatically use a resumable upload flow."
                        : "Optional: use a direct public image URL instead of uploading a file."}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="hidden lg:col-span-2 lg:block">
          <div className="lg:sticky lg:top-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</h3>
            {previewCard}
            {selectedPages.length > 1 ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Will post to <Badge variant="secondary" className="mx-1">{selectedPages.length} pages</Badge>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/70 bg-background/90 p-3 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:left-72">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-2 rounded-xl sm:flex-initial"
            onClick={saveDraft}
            disabled={draftLoading}
          >
            <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save as </span>Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)} className="flex-1 gap-2 rounded-xl sm:flex-initial">
            <Calendar className="h-4 w-4" /> Schedule
          </Button>
          <Button size="sm" onClick={publishNow} className="flex-1 gap-2 rounded-xl bg-gradient-primary shadow-elevated hover:opacity-90 sm:flex-initial">
            <Send className="h-4 w-4" /> Publish<span className="hidden sm:inline"> Now</span>
          </Button>
        </div>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[28px] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={() => setScheduleOpen(false)} className="w-full rounded-xl sm:w-auto">
              Cancel
            </Button>
            <Button onClick={schedulePost} className="w-full rounded-xl bg-gradient-primary sm:w-auto">
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishProgressOpen} onOpenChange={(open) => {
        if (publishStatus === "completed" || publishStatus === "failed") {
          setPublishProgressOpen(open);
        }
      }}>
        <DialogContent className="max-w-lg rounded-[28px] p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Video Publishing Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Device upload</span>
                <span className="text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-3" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Facebook publish</span>
                <span className="text-muted-foreground">{serverProgress}%</span>
              </div>
              <Progress value={serverProgress} className="h-3" />
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <p className="text-sm font-semibold">{publishStage}</p>
              <p className="mt-1 text-sm text-muted-foreground">{publishMessage}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishProgressOpen(false)}
              disabled={publishStatus === "uploading" || publishStatus === "publishing"}
              className="w-full rounded-xl sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePost;
