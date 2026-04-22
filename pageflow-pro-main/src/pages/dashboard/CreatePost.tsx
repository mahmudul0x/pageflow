import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Smile,
  Save,
  ThumbsUp,
  Type,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);

  const allSelected = pages.length > 0 && selectedPages.length === pages.length;
  const togglePage = (id: string) =>
    setSelectedPages((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleAll = () => setSelectedPages(allSelected ? [] : pages.map((page) => page.id));

  const previewPage = pages.find((page) => page.id === selectedPages[0]) ?? pages[0];

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);
    setPostType(file.type.startsWith("video") ? "video" : "image");
  };

  const validate = () => {
    if (selectedPages.length === 0) return toast.error("Select at least one page."), false;
    if (!content.trim()) return toast.error("Write something to post."), false;
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

  const publishNow = async () => {
    if (!validate()) return;

    try {
      const response = await postService.publish({
        page_ids: selectedPages,
        content,
        media_url: mediaFile ? undefined : mediaUrl ?? undefined,
        media_type: postType === "text" ? undefined : postType,
        file: mediaFile ?? undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["posts"] });

      const successPages = response.results
        .filter((result) => result.success)
        .map((result) => result.fb_post_id ? `${result.page} (${result.fb_post_id})` : result.page);
      const failedPages = response.results
        .filter((result) => !result.success)
        .map((result) => `${result.page}: ${result.error || "Unknown error"}`);

      toast.success(
        successPages.length
          ? `Published successfully: ${successPages.join(", ")}`
          : response.message
      );

      if (failedPages.length) {
        toast.error(`Failed pages: ${failedPages.join(" | ")}`);
      }

      setContent("");
      setSelectedPages([]);
      setMediaUrl(null);
      setMediaFile(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not publish. If needed, enable Facebook posting permission first.");
    }
  };

  const schedulePost = async () => {
    if (!scheduleDate || !scheduleTime) return toast.error("Pick date and time.");
    if (mediaFile) return toast.error("Image scheduling is not supported yet. Please use Publish Now for image posts.");

    try {
      await postService.schedule({
        page_ids: selectedPages,
        content,
        media_url: mediaUrl ?? undefined,
        scheduled_time: `${scheduleDate}T${scheduleTime}`,
      });
      toast.success("Post scheduled successfully.");
      setScheduleOpen(false);
      setContent("");
      setSelectedPages([]);
      setMediaUrl(null);
      setMediaFile(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not schedule the post.");
    }
  };

  const previewCard = (
    <Card className="border-border overflow-hidden bg-card">
      <div className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg flex-shrink-0">
          {previewPage?.avatar ?? "P"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{previewPage?.name ?? "Your Page"}</p>
          <p className="text-xs text-muted-foreground">Just now · Public</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="px-4 pb-3">
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {content || <span className="text-muted-foreground italic">Your post will appear here...</span>}
        </p>
      </div>
      {mediaUrl && (
        <div className="bg-muted">
          {postType === "video" ? (
            <video src={mediaUrl} className="w-full max-h-96 object-cover" controls />
          ) : (
            <img src={mediaUrl} alt="preview" className="w-full max-h-96 object-cover" />
          )}
        </div>
      )}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
        <span>1.2K reactions</span>
        <span>234 comments · 56 shares</span>
      </div>
      <div className="px-2 py-1 flex items-center justify-around border-t border-border">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map((action) => (
          <button key={action.label} className="flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded">
            <action.icon className="h-4 w-4" /> {action.label}
          </button>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto pt-20 lg:pt-10 pb-44 sm:pb-40">
      <div className="mb-6 sm:mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Create Post</h1>
          <p className="text-muted-foreground">Compose and publish to multiple pages at once</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={requestPostingPermission} disabled={permissionLoading}>
            {permissionLoading ? "Opening Facebook..." : "Enable Facebook Posting"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden gap-2"
            onClick={() => setMobilePreviewOpen((current) => !current)}
          >
            {mobilePreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {mobilePreviewOpen ? "Hide" : "Show"} preview
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        First connect page-list permission, then click `Enable Facebook Posting` to request the extra Meta permissions required for publishing.
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {mobilePreviewOpen && (
          <div className="lg:hidden">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Live Preview</h3>
            {previewCard}
          </div>
        )}

        <div className="lg:col-span-3 space-y-6">
          <Card className="p-4 sm:p-6 border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Pages</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="select-all" className="text-sm text-muted-foreground">Select all</Label>
                <Switch id="select-all" checked={allSelected} onCheckedChange={toggleAll} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {pages.map((page) => {
                const checked = selectedPages.includes(page.id);
                return (
                  <label
                    key={page.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => togglePage(page.id)} />
                    <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg flex-shrink-0">
                      {page.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{page.name}</p>
                      <p className="text-xs text-muted-foreground">{(page.followers / 1000).toFixed(1)}K followers</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 sm:p-6 border-border">
            <Tabs value={postType} onValueChange={(value) => setPostType(value as "text" | "image" | "video")} className="mb-4">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="text" className="flex-1 sm:flex-initial gap-2"><Type className="h-4 w-4" /> Text</TabsTrigger>
                <TabsTrigger value="image" className="flex-1 sm:flex-initial gap-2"><ImageIcon className="h-4 w-4" /> Image</TabsTrigger>
                <TabsTrigger value="video" className="flex-1 sm:flex-initial gap-2"><Video className="h-4 w-4" /> Video</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[160px] text-base resize-none border-border focus-visible:ring-primary"
                maxLength={2000}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="relative">
                  <Button variant="ghost" size="sm" onClick={() => setShowEmoji(!showEmoji)} className="gap-1.5">
                    <Smile className="h-4 w-4" /> Emoji
                  </Button>
                  {showEmoji && (
                    <div className="absolute bottom-full mb-2 left-0 bg-popover border border-border rounded-lg p-2 shadow-elevated grid grid-cols-8 gap-1 z-10">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setContent((current) => current + emoji);
                            setShowEmoji(false);
                          }}
                          className="h-8 w-8 hover:bg-muted rounded text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-xs ${content.length > 1800 ? "text-destructive" : "text-muted-foreground"}`}>
                  {content.length} / 2000
                </span>
              </div>
            </div>

            {postType !== "text" && (
              <div className="mt-4">
                {mediaUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    {postType === "video" ? (
                      <video src={mediaUrl} controls className="w-full max-h-80 object-cover" />
                    ) : (
                      <img src={mediaUrl} alt="upload preview" className="w-full max-h-80 object-cover" />
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => {
                        setMediaUrl(null);
                        setMediaFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 sm:p-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors text-center"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                  >
                    <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Drop your {postType} here, or tap to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, MP4 up to 100MB</p>
                    <input
                      type="file"
                      accept={postType === "video" ? "video/*" : "image/*"}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="hidden lg:block lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Live Preview</h3>
            {previewCard}
            {selectedPages.length > 1 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Will post to <Badge variant="secondary" className="mx-1">{selectedPages.length} pages</Badge>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-background/95 backdrop-blur border-t border-border p-3 sm:p-4 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" className="gap-2 flex-1 sm:flex-initial">
            <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save as </span>Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)} className="gap-2 flex-1 sm:flex-initial">
            <Calendar className="h-4 w-4" /> Schedule
          </Button>
          <Button size="sm" onClick={publishNow} className="bg-gradient-primary hover:opacity-90 shadow-elevated gap-2 flex-1 sm:flex-initial">
            <Send className="h-4 w-4" /> Publish<span className="hidden sm:inline"> Now</span>
          </Button>
        </div>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6">
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
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setScheduleOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={schedulePost} className="bg-gradient-primary w-full sm:w-auto">Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePost;
