export type ContentKind = 'paper' | 'model' | 'space' | 'dataset' | 'blog' | 'community' | 'hn' | 'video' | 'kaggle' | 'competition';

export const KIND_LABEL: Record<ContentKind, string> = {
  paper: 'Paper',
  model: 'Model',
  space: 'Space',
  dataset: 'Dataset',
  blog: 'Blog',
  community: 'Article',
  hn: 'HN',
  video: 'Video',
  kaggle: 'Kaggle',
  competition: 'Competition',
};

/** Where each kind comes from, for credits and fallbacks. */
export const KIND_SOURCE: Record<ContentKind, string> = {
  paper: 'Hugging Face',
  model: 'Hugging Face',
  space: 'Hugging Face',
  dataset: 'Hugging Face',
  blog: 'Hugging Face',
  community: 'Hugging Face',
  hn: 'Hacker News',
  video: 'HackerTube',
  kaggle: 'Kaggle',
  competition: 'Kaggle',
};

/** Normalized shape every adapter maps into. Also the persisted bookmark snapshot. */
export interface FeedItem {
  kind: ContentKind;
  /** Stable id within its kind: arXiv id, repo id, or blog path ("ns/slug" or "slug"). */
  id: string;
  title: string;
  summary?: string;
  /** ISO date used for sorting and "new" badges. */
  date?: string;
  /** Canonical page on the source site (fallback when in-app rendering is not possible). */
  url: string;
  /** External target the item points at (an HN story's article, a video on YouTube). */
  link?: string;
  image?: string;
  /** Space emoji, shown when there is no thumbnail. */
  emoji?: string;
  authors: string[];
  /** Source handles (HF users/orgs, HN or Kaggle users) associated with the item, used for Following. */
  handles: string[];
  tags: string[];
  upvotes?: number;
  likes?: number;
  downloads?: number;
  /** HN comment count. */
  comments?: number;
  /** Distinct HN commenters who recommended a video (HackerTube). */
  recommenders?: number;
}

export const itemKey = (item: Pick<FeedItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;
