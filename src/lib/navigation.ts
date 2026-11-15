import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { recordOpen } from '@/features/activity/store';
import type { FeedItem } from '@/features/feed/types';
import { rememberItems } from '@/lib/item-cache';

/** Opens a URL in the in-app browser (SFSafariViewController / Custom Tabs) or a new tab on web. */
export async function openExternal(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    // Some Android devices have no Custom Tabs browser; nothing else to do.
  }
}

/** In-app detail route, or null for kinds that open on their source site (Spaces, Kaggle). */
export function detailHref(item: Pick<FeedItem, 'kind' | 'id'>): string | null {
  switch (item.kind) {
    case 'space':
    case 'dataset':
    case 'kaggle':
    case 'competition':
      return null;
    case 'hn':
      return `/hn/${encodeURIComponent(item.id)}`;
    case 'video':
      return `/video/${encodeURIComponent(item.id)}`;
    case 'paper':
      return `/paper/${encodeURIComponent(item.id)}`;
    case 'model':
      return `/model/${item.id.split('/').map(encodeURIComponent).join('/')}`;
    default:
      return `/article/${item.kind}/${item.id.split('/').map(encodeURIComponent).join('/')}`;
  }
}

export function openItem(item: FeedItem) {
  rememberItems([item]);
  recordOpen(item);
  const href = detailHref(item);
  if (href) router.push(href as never);
  else void openExternal(item.url);
}

/** Go back, or home when the screen was opened directly (deep link / web refresh). */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
