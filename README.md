# HackerFeed

An independent, open-source reader for iOS, Android, and Web that puts the places a curious engineer reads into one calm feed: **Hugging Face** (papers, models, blog, community articles, Spaces, datasets), **Hacker News**, **Kaggle**, and **HackerTube** videos.

> **Independent.** HackerFeed isn't affiliated with or endorsed by Hugging Face, Hacker News / Y Combinator, Kaggle, HackerTube, or YouTube. It only reads public data (plus your own Kaggle key, if you add one). All trademarks belong to their owners.

## Features

- **Home**: one feed across all sources, with three modes:
  - **For You**: ranked by freshness, popularity, the topics you pick, and what it learns from what you open and save. Learning happens on your device and you can reset it.
  - **Latest**: newest first, with a "you're all caught up" divider where your last visit ends.
  - **Following**: Hugging Face accounts, Hacker News users and video channels you follow (stored on your device).
  - **Today's 5**: a finite daily digest, one pick each from papers, Hacker News, models, videos and blogs, with checkmarks as you open them.
- **Papers**: Today, This week, This month (ranked by upvotes) and Trending, with abstracts, linked models/datasets/Spaces, and a swipeable reader.
- **Trending**: Hugging Face Models, Spaces and Datasets, plus **Kaggle** hottest datasets and, with your key, Kaggle competitions.
- **Read**: Hacker News (front page, best this week, Ask, Show, New) with an in-app comment thread; the Hugging Face blog and community articles.
- **Watch**: about 3,000 talks and videos that Hacker News commenters keep recommending (HackerTube's catalog, bundled so it works offline). Frames are shown instead of clickbait thumbnails.
- **You**: reading streak, weekly reading goal, GitHub-style activity heatmap, badges, and saved items. Saved items take **private notes**, and Search covers both items and notes.
- **Search**: models, papers, Spaces, datasets, Hacker News stories, videos, and your saved items.
- **Preferences**: theme, layout (rich cards or compact HN-style list), which sources appear in Home, weekly goal, topics, learned interests, following, and your Kaggle key.

## Getting started

Requires Node 20 or newer.

```bash
npm install
npm start          # then press i (iOS simulator), a (Android emulator) or w (web)
```

All dependencies are part of the Expo SDK, so the app runs in **Expo Go**. You don't need a custom development build.

## Development commands

| Command             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `npm start`         | Expo dev server                               |
| `npm run ios`       | Start and open in the iOS simulator           |
| `npm run android`   | Start and open in an Android emulator/device  |
| `npm run web`       | Start the web build                           |
| `npm run lint`      | ESLint (`expo lint`, includes React Compiler) |
| `npm run typecheck` | `tsc --noEmit` (strict)                       |
| `npm test`          | Jest (`jest-expo`)                            |
| `npm run check`     | lint + typecheck + tests                      |
| `npm run format`    | Prettier                                      |
| `npm run data:hackertube` | Rebuild the bundled video catalog from HackerTube's latest export |

## Architecture

```
src/
  app/                 Expo Router routes (screens only)
    (tabs)/            Home, Papers, Trending, Read, Watch, You
    paper/[id]         Paper detail with horizontal pager
    hn/[id]            Hacker News story + comments
    video/[vid]        Video detail (opens YouTube)
    model/[...id]      Model detail (repo ids contain "/")
    article/[source]/[...path]
    search, settings
  features/
    papers/api.ts      Daily Papers, paper detail, paper search
    models/api.ts      Model list (cursor pagination), detail, model card
    blogs/api.ts       Official blog (JSON, RSS fallback), community articles
    feed/              Shared FeedItem type, ranking, TanStack Query hooks
    repos/api.ts       Trending Spaces and Datasets
    hn/api.ts          Hacker News via Algolia (feeds, search, comment trees)
    kaggle/            Datasets (anonymous), competitions (your key, kept in secure storage)
    videos/            Bundled HackerTube catalog + search and daily picks
    activity/          Reading stats (streaks, heatmap, badges) and learned affinity
    saved/, preferences/   Persistent local stores
  components/          Cards, lists, Markdown renderer, empty/error/skeleton states
  lib/                 HTTP client, Markdown parser, formatting, navigation helpers
  theme/               Colors (light/dark), spacing
```

- **Typed adapters.** Each source has its own adapter that maps raw API data to a typed model and then to a shared `FeedItem`. Missing fields are tolerated everywhere.
- **Data fetching.** TanStack Query handles caching (5-minute stale time), infinite pagination, pull-to-refresh, and retries. Retries happen for network errors, 5xx responses, and 429 responses, and 429 retries wait for the reset window in HF's `RateLimit` header.
- **Home feed paging.** Page *N* from every source is ranked as one batch. Loading more appends new items and doesn't reorder what's already on screen.
- **Ranking.** The ranker in `features/feed/rank.ts` is pure, rule-based, and covered by tests. It never shows three items of the same type in a row.
- **Local storage.** A small observable store keeps data as JSON in AsyncStorage (`localStorage` on web). There is no backend and no login.
- **Markdown.** A dependency-free Markdown subset renderer displays model cards and blog posts. It supports headings, lists, code, tables (including HTML tables), images, links, and GitHub admonitions.

### Data sources

| Content                  | Endpoint                                                  | Status                                           |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| Daily / trending papers  | `GET /api/daily_papers?p=&limit=&sort=trending`           | Public Hub API                                   |
| Weekly / monthly top     | `GET /api/daily_papers?week=2026-W46` / `?month=2026-11`  | Public Hub API, sorted by upvotes                |
| Spaces / datasets        | `GET /api/spaces`, `GET /api/datasets` (`sort=trendingScore`) | Documented Hub API, `Link` cursor pagination |
| Paper detail / search    | `GET /api/papers/{id}`, `GET /api/papers/search?q=`       | Public Hub API (search: 50 req / 5 min)          |
| Models                   | `GET /api/models?sort=&search=&author=&pipeline_tag=`     | Documented Hub API, `Link` cursor pagination     |
| Model detail / card      | `GET /api/models/{id}`, `/{id}/raw/main/README.md`        | Documented Hub API                               |
| Official blog            | `GET /api/blog?p=` → fallback `/blog/feed.xml` (RSS)      | JSON is undocumented; RSS is the official feed   |
| Official post body       | `raw.githubusercontent.com/huggingface/blog/main/{slug}.md` | Public source repo of the HF blog              |
| Community articles       | `GET /api/blog/community?p=&sort=trending`                | Undocumented JSON used by huggingface.co         |
| Community / partner body | The article page (`.blog-content`), iOS/Android only      | Best-effort HTML extraction, browser fallback    |
| Hacker News              | `hn.algolia.com/api/v1/search` (`front_page`, `ask_hn`, `show_hn`, `numericFilters`), `/items/{id}` | Public, CORS-enabled |
| Kaggle datasets          | `www.kaggle.com/api/v1/datasets/list?sortBy=hottest`      | Works without a key, CORS-enabled                |
| Kaggle competitions      | `www.kaggle.com/api/v1/competitions/list`                 | Needs your username + API key (HTTP Basic)       |
| Videos                   | HackerTube's open data export, bundled as JSON            | ODC-By 1.0; refresh with `npm run data:hackertube` |

I checked the Hugging Face, Hacker News and Kaggle endpoints on 2026-11-15, including that they're CORS-enabled for web. The one exception is `feed.xml`: it has no CORS header, so the RSS fallback only works on iOS and Android. When something can't be loaded, the app offers an **Open on Hugging Face** link instead.

## Supported platforms

- **iOS and Android.** Phones and tablets, through Expo Go or a native build. Links open in the in-app browser (SFSafariViewController or Custom Tabs).
- **Web.** Runs as a single-page app in modern browsers. On wide screens, content is centered in a readable column.

## Limitations

- **Accounts.** You can sign in with Hugging Face (OAuth with PKCE, scopes `openid profile write-discussions`, token kept on your device). **Upvote** then tries `POST /api/papers/{id}/upvote`. That endpoint isn't documented for OAuth tokens, so if Hugging Face rejects it, the paper page opens instead. Commenting isn't built yet. Hacker News and Kaggle have no sign-in. Following in this app is local only.
- **Your own OAuth app.** The client id in `src/features/auth/session.ts` is public. If you fork the project, register your own app at huggingface.co/settings/applications with redirect URLs `hackerfeed://auth` and `http://localhost:8081/auth`.
- **Kaggle key.** It's stored in the Keychain/Keystore on iOS and Android, and in `localStorage` on web (the browser has no secure store). It's only ever sent to kaggle.com. The competitions response format is the one part I couldn't check without a key, so that adapter is deliberately tolerant.
- **Videos.** The catalog is a snapshot (top ~3,000 by HackerTube's score, no publish dates), refreshed by a script. Videos open on YouTube.
- **No notifications.** The app has no push notifications. It shows **NEW** badges for items published since your last visit.
- **Benchmarks.** Only results that the model card reports in its `model-index` metadata appear. Hub-hosted eval results (the `eval-results` tag) aren't parsed yet, but the card's own tables still render.
- **Partner and community articles.** These have no API or Markdown source. On iOS and Android the app pulls the text out of the article page. This is isolated in `lib/html-article.ts`, tested against a real page, and falls back to the in-app browser if the page layout changes. On web they open on huggingface.co, because the page doesn't allow loading from other sites.
- **Spaces and datasets.** These open on huggingface.co. Spaces are interactive apps, and datasets don't have an in-app detail screen yet.
- **Stats stay on the device.** Streaks, badges and learned interests aren't synced between devices.
- **Undocumented endpoints.** `/api/blog` and `/api/blog/community` could change without notice. Their adapters are isolated so a change is quick to fix.
- **Markdown coverage.** The renderer covers a subset of Markdown. Embedded HTML widgets, LaTeX, and videos are skipped.

## Follow-ups

- Parse Hub-hosted evaluation results and add model comparison.
- Datasets and Spaces tabs.
- Paper comments, and real following, once the HF endpoints are confirmed for OAuth tokens.
- Background fetch with local notifications for followed accounts.
- Offline reading for saved items, and full-text search over them.
- End-to-end tests (Maestro) on simulators in CI.

## License

Apache-2.0. See [LICENSE](LICENSE).

## Credits

- Video curation: [HackerTube](https://hackertube.org) (ODC-By 1.0), derived from the [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) dataset. Hacker News data © Y Combinator; comments belong to their authors; video titles and channels belong to their creators.
- Hugging Face and the 🤗 logo are trademarks of Hugging Face, Inc. Kaggle is a trademark of Google LLC.
