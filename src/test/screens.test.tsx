import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import HomeScreen from '@/app/(tabs)/index';
import SavedScreen from '@/app/(tabs)/you';
import { FeedCard } from '@/components/FeedCard';
import type { FeedItem } from '@/features/feed/types';
import { DEFAULT_HOME_KINDS, setPreference } from '@/features/preferences/store';
import { savedStore } from '@/features/saved/store';
import { mockFetch } from '@/test/mock-fetch';

import blogFixture from '@/test/fixtures/blog.json';
import communityFixture from '@/test/fixtures/community.json';
import dailyFixture from '@/test/fixtures/daily_papers.json';
import modelsFixture from '@/test/fixtures/models.json';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const paper: FeedItem = {
  kind: 'paper',
  id: '2611.00001',
  title: 'A Test Paper',
  summary: 'Abstract',
  url: 'https://huggingface.co/papers/2611.00001',
  authors: ['Ada Lovelace'],
  handles: [],
  tags: [],
  upvotes: 12,
};

beforeEach(async () => {
  await act(() => savedStore.set({ version: 1, entries: {} }));
});

describe('FeedCard', () => {
  it('shows content type, metadata and toggles the bookmark', async () => {
    const onPress = jest.fn();
    await render(<FeedCard item={paper} onPress={onPress} />);
    expect(screen.getByText('PAPER')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save A Test Paper'));
    expect(savedStore.get().entries['paper:2611.00001']).toBeDefined();
    await fireEvent.press(screen.getByLabelText('Remove A Test Paper from saved'));
    expect(savedStore.get().entries['paper:2611.00001']).toBeUndefined();
    await fireEvent.press(screen.getByLabelText(/^Paper: A Test Paper/));
    expect(onPress).toHaveBeenCalledWith(paper);
  });
});

describe('Saved screen', () => {
  it('shows the empty state, then saved items', async () => {
    await render(<SavedScreen />);
    expect(screen.getByText('No saved items')).toBeTruthy();
    await act(() =>
      savedStore.set({
        version: 1,
        entries: { 'paper:2611.00001': { item: paper, savedAt: 1 } },
      }),
    );
    expect(screen.getByText('A Test Paper')).toBeTruthy();
  });
});

describe('Home screen', () => {
  it('renders a unified feed from all sources with the unofficial notice', async () => {
    const { calls } = mockFetch([
      ['/api/daily_papers', { body: dailyFixture }],
      ['/api/models', { body: modelsFixture }],
      ['/api/blog/community', { body: communityFixture }],
      ['/api/blog', { body: blogFixture }],
      [
        'hn.algolia.com',
        {
          body: {
            nbPages: 1,
            hits: [
              { objectID: '7', title: 'A Hacker News story', url: 'https://example.com/a', author: 'pg', points: 99, num_comments: 5 },
            ],
          },
        },
      ],
    ]);
    await render(wrap(<HomeScreen />));
    expect(screen.getByText(/Not affiliated with or endorsed by Hugging Face/)).toBeTruthy();
    await screen.findAllByText('MODEL');
    // All four sources are requested and merged into one list of labelled cards.
    for (const path of ['/api/daily_papers', '/api/models', '/api/blog?', '/api/blog/community', 'hn.algolia.com'])
      expect(calls.some((u) => u.includes(path))).toBe(true);
    const kinds = new Set(screen.getAllByText(/^(PAPER|MODEL|BLOG|ARTICLE|HN|VIDEO)$/).map((n) => n.props.children));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('shows an error with retry when every source fails', async () => {
    mockFetch([]);
    // Videos are bundled with the app and never fail, so exclude them to test the all-sources-down state.
    await act(() =>
      setPreference(
        'homeKinds',
        DEFAULT_HOME_KINDS.filter((k) => k !== 'video'),
      ),
    );
    await render(wrap(<HomeScreen />));
    expect(await screen.findByText("Couldn't load this")).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    await act(() => setPreference('homeKinds', DEFAULT_HOME_KINDS));
  });
});
