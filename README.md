# Webflow Community Pulse

Community monitoring and insights dashboard for r/webflow and other Webflow communities. Track conversations, identify trends, and surface high-value content.

## 📁 Project Structure

```
webflow-community-pulse/
├── src/
│   ├── db/                    # Database schema and queries
│   ├── pages/                 # Astro pages and API routes
│   │   └── api/              # API endpoints
│   └── ...
├── docs/                      # Documentation
│   └── reddit/               # Reddit moderation configs
│       ├── IMPLEMENTATION-GUIDE.md
│       ├── reddit-automod-config.yaml
│       ├── reddit-weekly-thread-templates.md
│       └── automod-examples.md
├── scripts/                   # Utility scripts
│   └── analysis/             # Data analysis scripts
│       ├── analyze-posts.mjs
│       ├── analyze-detailed.mjs
│       └── test-automod-rules.mjs
├── data/                      # Data exports (not committed)
│   └── dev-export.json
└── backfill.md               # Data sync documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Cloudflare account (for D1 database)
- Reddit API access
- Anthropic API key

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:
```env
ANTHROPIC_API_KEY=your_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
COMMON_ROOM_API_TOKEN=your_token
```

### Development

```bash
npm run dev
```

Visit `http://localhost:4321`

### Build

```bash
npm run build
```

## 🗄️ Database

This project uses Cloudflare D1 (SQLite) with Drizzle ORM.

**Schema:** `src/db/schema/index.ts`

**Tables:**
- `authors` - Content contributors
- `content_items` - Posts and comments
- `engagement_snapshots` - Engagement over time
- `insights` - AI-generated community insights
- `roundups` - Weekly community roundups
- `users` - Authenticated dashboard users
- `sessions` - User sessions

## 📊 Analysis Scripts

Export your database and run analysis scripts:

```bash
# Export database
curl http://localhost:4321/api/admin/export > data/dev-export.json

# Run analysis
node scripts/analysis/analyze-posts.mjs
node scripts/analysis/analyze-detailed.mjs
node scripts/analysis/test-automod-rules.mjs
```

See `scripts/analysis/README.md` for details.

## 🤖 Reddit Moderation

Complete AutoMod configuration for managing r/webflow:

- **Feedback Friday** - Weekly feedback thread
- **Weekly Hiring Thread** - Job postings
- **Self Promotion Thread** - Services, tools, templates

See `docs/reddit/README.md` for implementation guide.

## 🔑 API Endpoints

### Public
- `GET /api/content` - List content items
- `GET /api/stats` - Dashboard statistics
- `GET /api/insights` - Community insights
- `GET /api/showcases` - Featured showcases

### Admin (requires auth)
- `GET /api/admin/export` - Export database
- `POST /api/admin/sync` - Sync data from external sources
- `POST /api/insights/generate` - Generate new insights
- `POST /api/roundups` - Create/manage roundups

## 📝 Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run deploy` | Deploy to Cloudflare |

## 🛠️ Tech Stack

- **Framework:** Astro
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle
- **Hosting:** Cloudflare Pages
- **Auth:** Google OAuth
- **AI:** Anthropic Claude

## 📖 Documentation

- [Reddit Moderation Guide](docs/reddit/README.md)
- [Analysis Scripts](scripts/analysis/README.md)
- [Data Exports](data/README.md)
- [Backfill Process](backfill.md)

## 🤝 Contributing

This is a private project for Webflow community management. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a PR

## 📄 License

Private project - All rights reserved.
