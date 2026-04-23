import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildFacebookPostUrl(
  fbPostId?: string,
  options?: { pageFbId?: string; mediaType?: string | null }
) {
  if (!fbPostId) return null;
  if (fbPostId.includes("_")) {
    return `https://www.facebook.com/${fbPostId}`;
  }
  if (options?.mediaType === "video") {
    return `https://www.facebook.com/watch/?v=${fbPostId}`;
  }
  if (options?.pageFbId) {
    return `https://www.facebook.com/${options.pageFbId}/posts/${fbPostId}`;
  }
  return `https://www.facebook.com/${fbPostId}`;
}
