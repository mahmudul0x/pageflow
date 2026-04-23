export interface FBPage {
  id: string;
  name: string;
  category: string;
  followers: number;
  avatar: string;
  enabled: boolean;
}

export interface Post {
  id: string;
  pageIds: string[];
  pageNames: string[];
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  status: 'published' | 'scheduled' | 'draft' | 'failed';
  createdAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  hidden?: boolean;
  reach?: number;
  engagement?: number;
  publishResults?: Array<{
    page: string;
    success: boolean;
    fbPostId?: string;
    error?: string;
  }>;
}

export const mockPages: FBPage[] = [
  { id: 'p1', name: 'Dhaka Food Blog', category: 'Food & Beverage', followers: 124500, avatar: '🍛', enabled: true },
  { id: 'p2', name: 'Travel Bangladesh', category: 'Travel', followers: 89300, avatar: '✈️', enabled: true },
  { id: 'p3', name: 'Tech News BD', category: 'Technology', followers: 56200, avatar: '💻', enabled: true },
  { id: 'p4', name: 'Lifestyle BD', category: 'Lifestyle', followers: 42100, avatar: '🌸', enabled: false },
];

export const mockPosts: Post[] = [
  {
    id: 'po1',
    pageIds: ['p1'],
    pageNames: ['Dhaka Food Blog'],
    content: 'আজকের বিশেষ রেসিপি: কাচ্চি বিরিয়ানি 🍛 ঢাকার সেরা স্বাদ এখন আপনার ঘরে!',
    status: 'published',
    createdAt: '2026-04-19T10:30:00Z',
    reach: 24500,
    engagement: 1820,
  },
  {
    id: 'po2',
    pageIds: ['p2', 'p4'],
    pageNames: ['Travel Bangladesh', 'Lifestyle BD'],
    content: 'Discover the breathtaking beauty of Sajek Valley this season — clouds at your feet, peace in your heart. ☁️🏔️',
    status: 'scheduled',
    createdAt: '2026-04-20T08:00:00Z',
    scheduledFor: '2026-04-25T09:00:00Z',
  },
  {
    id: 'po3',
    pageIds: ['p3'],
    pageNames: ['Tech News BD'],
    content: 'Breaking: Bangladesh launches its first AI research lab in Dhaka 🚀 #TechBD',
    status: 'published',
    createdAt: '2026-04-18T14:20:00Z',
    reach: 18200,
    engagement: 1240,
  },
  {
    id: 'po4',
    pageIds: ['p1', 'p2'],
    pageNames: ['Dhaka Food Blog', 'Travel Bangladesh'],
    content: 'Top 5 street food spots in Old Dhaka you must try this weekend! 🥘',
    status: 'scheduled',
    createdAt: '2026-04-20T11:00:00Z',
    scheduledFor: '2026-04-23T17:30:00Z',
  },
  {
    id: 'po5',
    pageIds: ['p4'],
    pageNames: ['Lifestyle BD'],
    content: 'Spring fashion trends 2026 — minimalism meets desi heritage 🌸',
    status: 'draft',
    createdAt: '2026-04-21T09:00:00Z',
  },
  {
    id: 'po6',
    pageIds: ['p3'],
    pageNames: ['Tech News BD'],
    content: 'Review: The new bKash app update — what changed and why it matters.',
    status: 'scheduled',
    createdAt: '2026-04-21T07:00:00Z',
    scheduledFor: '2026-04-28T12:00:00Z',
  },
];

export const mockUser = {
  id: 'u1',
  name: 'Rahim Ahmed',
  email: 'rahim@pageflow.app',
  avatar: 'RA',
};

export const mockAnalytics = {
  totalReach: 342800,
  impressions: 528400,
  pageLikes: 312100,
  engagementRate: 5.8,
  reachOverTime: [
    { date: 'Apr 15', reach: 12400, impressions: 18200 },
    { date: 'Apr 16', reach: 15800, impressions: 22400 },
    { date: 'Apr 17', reach: 14200, impressions: 21000 },
    { date: 'Apr 18', reach: 19500, impressions: 28100 },
    { date: 'Apr 19', reach: 22800, impressions: 33200 },
    { date: 'Apr 20', reach: 21000, impressions: 30500 },
    { date: 'Apr 21', reach: 26400, impressions: 38900 },
  ],
  postPerformance: [
    { name: 'Kacchi Recipe', reach: 24500, engagement: 1820 },
    { name: 'Sajek Valley', reach: 18200, engagement: 1340 },
    { name: 'AI Lab News', reach: 18200, engagement: 1240 },
    { name: 'Street Food', reach: 15600, engagement: 980 },
    { name: 'Spring Fashion', reach: 12100, engagement: 720 },
  ],
};
