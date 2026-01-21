# Project Organization - Summary

## Changes Made

The project has been reorganized from a flat structure with many files in the root directory to a clean, logical folder structure.

## New Structure

```
webflow-community-pulse/
├── docs/                           # Documentation
│   └── reddit/                    # Reddit moderation configs & guides
│       ├── README.md
│       ├── IMPLEMENTATION-GUIDE.md
│       ├── reddit-automod-config.yaml
│       ├── reddit-weekly-thread-templates.md
│       └── automod-examples.md
│
├── scripts/                        # Utility scripts
│   └── analysis/                  # Data analysis scripts
│       ├── README.md
│       ├── analyze-posts.mjs
│       ├── analyze-detailed.mjs
│       └── test-automod-rules.mjs
│
├── data/                          # Data exports (gitignored)
│   ├── README.md
│   └── dev-export.json
│
├── src/                           # Application source code
│   ├── db/                       # Database schema
│   ├── pages/                    # Astro pages & API routes
│   └── ...
│
├── README.md                      # Updated project README
├── backfill.md                    # Data sync documentation
└── ...                           # Config files (package.json, etc.)
```

## Files Moved

### From Root → `docs/reddit/`
- `IMPLEMENTATION-GUIDE.md`
- `reddit-automod-config.yaml`
- `reddit-weekly-thread-templates.md`
- `automod-examples.md`

### From Root → `scripts/analysis/`
- `analyze-posts.mjs`
- `analyze-detailed.mjs`
- `test-automod-rules.mjs`

### From Root → `data/`
- `dev-export.json`

## New Files Created

- `docs/reddit/README.md` - Guide to Reddit moderation docs
- `scripts/analysis/README.md` - Guide to analysis scripts
- `data/README.md` - Guide to data exports
- `README.md` - Updated main project README
- `PROJECT-ORGANIZATION.md` - This file

## Updates Made

1. **Analysis scripts updated** to reference new data path (`../../data/dev-export.json`)
2. **`.gitignore` updated** to exclude `data/` directory
3. **Main README updated** with new project structure and documentation
4. **Reddit AutoMod config updated** with three weekly threads:
   - Monday: Weekly Hiring Thread
   - Friday: Feedback Friday
   - Sunday: Self Promotion Sunday

## Reddit Moderation Strategy

The project now includes a complete implementation package for three weekly Reddit threads:

### 1. Weekly Hiring Thread (Mondays)
- Job postings from employers
- "Looking for developer/designer" posts
- Freelancers posting availability
- Clear separation between hiring and self-promotion

### 2. Feedback Friday (Fridays)
- Project feedback requests
- Portfolio reviews
- Constructive critique
- "Rate my site" posts

### 3. Self Promotion Sunday (Sundays)
- Tool/template launches
- Service offerings ("I'm available for hire")
- Content promotion (with exceptions for quality content)
- Deals and discounts

### Always Allowed
- Tutorials and educational content (blogs, YouTube)
- Completed showcases (not asking for feedback)
- Technical questions and discussions
- Community discussions
- High-quality resources

## Usage

### Running Analysis Scripts

```bash
# Export your database first
curl http://localhost:4321/api/admin/export > data/dev-export.json

# Run analysis
node scripts/analysis/analyze-posts.mjs
node scripts/analysis/analyze-detailed.mjs
node scripts/analysis/test-automod-rules.mjs
```

### Implementing Reddit Moderation

See `docs/reddit/IMPLEMENTATION-GUIDE.md` for complete step-by-step instructions.

## Benefits of New Structure

1. **Cleaner root directory** - Only essential config files at root
2. **Logical grouping** - Related files organized together
3. **Better discoverability** - README files in each major folder
4. **Clearer separation** - Docs, scripts, and data in separate folders
5. **Gitignore compliance** - Large data exports excluded from git
6. **Better maintainability** - Easy to find and update related files

## Next Steps

1. Implement Reddit moderation using `docs/reddit/` configs
2. Run analysis scripts from `scripts/analysis/` as needed
3. Keep `data/` folder for local analysis (never commit)
4. Update documentation as the project evolves
