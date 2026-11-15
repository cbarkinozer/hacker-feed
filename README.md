# huggingface-mobile

An unofficial, open-source Hugging Face client for iOS, Android, and Web. Browse Daily Papers, trending models, the official blog, and community articles in one mobile-first app.

> **Unofficial.** This project is not affiliated with or endorsed by Hugging Face. It only reads public data from huggingface.co.

## Features

- **Home**: one feed that mixes papers, models, blog posts, and community articles, with three modes:
  - **For You**: ranked by freshness and popularity. Topics you pick get a boost.
  - **Latest**: newest first.
  - **Following**: users and orgs you follow (stored on your device, no account).
  - Items published since your last visit get a **NEW** badge.
- **Papers**: Daily and Trending papers. Each paper shows its abstract, authors, keywords, and links to arXiv, the PDF, code, and the project page. Swipe sideways in the paper view to move through the list.
- **Models**: sort by trending, recently updated, most liked, or most downloaded, and filter by task. Each model shows its model card, the benchmark results it reports, its tags, base models, and Spaces.
- **Blogs**: the official blog, rendered in full inside the app, plus Community articles (Recent and Trending).
- **Search**: models and papers.
- **Saved**: local bookmarks for any item, which work offline.
- **Preferences**: system, light, or dark theme; which content types appear in Home; topics for For You; who you follow.

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

## Architecture

```
src/
  app/                 Expo Router routes (screens only)
    (tabs)/            Home, Papers, Models, Blogs, Saved
    paper/[id]         Paper detail with horizontal pager
    model/[...id]      Model detail (repo ids contain "/")
    article/[source]/[...path]
    search, settings
  features/
    papers/api.ts      Daily Papers, paper detail, paper search
    models/api.ts      Model list (cursor pagination), detail, model card
    blogs/api.ts       Official blog (JSON, RSS fallback), community articles
    feed/              Shared FeedItem type, ranking, TanStack Query hooks
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
| Paper detail / search    | `GET /api/papers/{id}`, `GET /api/papers/search?q=`       | Public Hub API (search: 50 req / 5 min)          |
| Models                   | `GET /api/models?sort=&search=&author=&pipeline_tag=`     | Documented Hub API, `Link` cursor pagination     |
| Model detail / card      | `GET /api/models/{id}`, `/{id}/raw/main/README.md`        | Documented Hub API                               |
| Official blog            | `GET /api/blog?p=` → fallback `/blog/feed.xml` (RSS)      | JSON is undocumented; RSS is the official feed   |
| Official post body       | `raw.githubusercontent.com/huggingface/blog/main/{slug}.md` | Public source repo of the HF blog              |
| Community articles       | `GET /api/blog/community?p=&sort=trending`                | Undocumented JSON used by huggingface.co         |

I checked all of these on 2026-11-15, including that they're CORS-enabled for web. The one exception is `feed.xml`: it has no CORS header, so the RSS fallback only works on iOS and Android. When something can't be loaded, the app offers an **Open on Hugging Face** link instead.

## Supported platforms

- **iOS and Android.** Phones and tablets, through Expo Go or a native build. Links open in the in-app browser (SFSafariViewController or Custom Tabs).
- **Web.** Runs as a single-page app in modern browsers. On wide screens, content is centered in a readable column.

## Limitations

- **No account features.** Upvoting, commenting, and following on huggingface.co need a login, which is out of scope for the MVP. The **Upvote on HF** button opens the paper page on the website instead. Following in this app is local only.
- **No notifications.** The app has no push notifications. It shows **NEW** badges for items published since your last visit.
- **Benchmarks.** Only results that the model card reports in its `model-index` metadata appear. Hub-hosted eval results (the `eval-results` tag) aren't parsed yet, but the card's own tables still render.
- **Partner and community articles.** Only official canonical posts have a public Markdown source. Partner/org posts (`/blog/{org}/{slug}`) and community articles open in the in-app browser.
- **Undocumented endpoints.** `/api/blog` and `/api/blog/community` could change without notice. Their adapters are isolated so a change is quick to fix.
- **Markdown coverage.** The renderer covers a subset of Markdown. Embedded HTML widgets, LaTeX, and videos are skipped.

## Follow-ups

- Parse Hub-hosted evaluation results and add model comparison.
- Datasets and Spaces tabs.
- Optional HF OAuth sign-in for upvotes and real following.
- Background fetch with local notifications for followed accounts.
- Offline reading for saved items, and full-text search over them.
- End-to-end tests (Maestro) on simulators in CI.

## License

Apache-2.0. See [LICENSE](LICENSE). Hugging Face and the 🤗 logo are trademarks of Hugging Face, Inc.
