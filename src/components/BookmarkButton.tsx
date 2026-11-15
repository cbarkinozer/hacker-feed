import type { FeedItem } from '@/features/feed/types';
import { toggleSaved, useIsSaved } from '@/features/saved/store';
import { useColors } from '@/theme';

import { IconButton } from './ui';

export function BookmarkButton({ item, size = 22 }: { item: FeedItem; size?: number }) {
  const saved = useIsSaved(item);
  const c = useColors();
  return (
    <IconButton
      icon={saved ? 'bookmark' : 'bookmark-outline'}
      color={saved ? c.accentStrong : c.textMuted}
      size={size}
      label={saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
      onPress={() => toggleSaved(item)}
    />
  );
}
