import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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

export function detailHref(item: Pick<FeedItem, 'kind' | 'id'>): string {
  switch (item.kind) {
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
  router.push(detailHref(item) as never);
}
