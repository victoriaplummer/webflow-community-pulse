# Analysis Scripts

Scripts for analyzing r/webflow post data and testing moderation strategies.

## Prerequisites

1. Export your database data:
   ```bash
   # Visit your local dev server or production
   curl http://localhost:4321/api/admin/export > ../../data/dev-export.json
   ```

2. Make sure the export file is in `data/dev-export.json`

## Available Scripts

### `analyze-posts.mjs`
High-level overview of post inventory and moderation recommendations.

**Run:**
```bash
node scripts/analysis/analyze-posts.mjs
```

**Output:**
- Total post count
- Classification breakdown (questions, resources, spam, etc.)
- Topic breakdown (career, design, cms, etc.)
- Quality score distribution
- Engagement analysis
- Clutter identification
- High-value content identification
- Moderation recommendations

### `analyze-detailed.mjs`
Detailed analysis with examples of specific post types.

**Run:**
```bash
node scripts/analysis/analyze-detailed.mjs
```

**Output:**
- Spam/self-promo examples
- Rant post examples
- Low quality + low engagement posts
- High-quality showcase examples
- Tutorial examples
- High-engagement discussions
- Resource post examples
- Question quality analysis

### `test-automod-rules.mjs`
Tests AutoMod rules against existing posts to predict impact.

**Run:**
```bash
node scripts/analysis/test-automod-rules.mjs
```

**Output:**
- Number of posts that would be redirected to weekly threads
- Spam removals
- High-quality exceptions that would remain
- Sample posts in each category
- Impact metrics (quality/engagement improvements)

## Results

All three scripts run against the exported database and provide insights for:
- Understanding current content distribution
- Identifying clutter vs high-value posts
- Testing moderation strategies before implementing
- Predicting impact of AutoMod rules
