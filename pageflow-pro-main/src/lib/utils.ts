import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildFacebookPostUrl(fbPostId?: string) {
  if (!fbPostId) return null;
  if (fbPostId.includes("_")) {
    return `https://www.facebook.com/${fbPostId}`;
  }
  return `https://www.facebook.com/watch/?v=${fbPostId}`;
}
