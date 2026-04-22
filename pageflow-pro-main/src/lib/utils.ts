import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function buildFacebookPostUrl(fbPostId?: string) {
  if (!fbPostId) return null;
  return `https://www.facebook.com/${fbPostId}`;
}
