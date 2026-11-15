export type ContentKind = 'paper' | 'model' | 'blog' | 'community';

export const KIND_LABEL: Record<ContentKind, string> = {
  paper: 'Paper',
  model: 'Model',
  blog: 'Blog',
  community: 'Article',
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
  /** Canonical huggingface.co URL (fallback when in-app rendering is not possible). */
  url: string;
  image?: string;
  authors: string[];
  /** HF handles (users/orgs) associated with the item, used for Following. */
  handles: string[];
  tags: string[];
  upvotes?: number;
  likes?: number;
  downloads?: number;
}

export const itemKey = (item: Pick<FeedItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;
