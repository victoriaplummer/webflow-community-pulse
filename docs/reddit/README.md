# Reddit Moderation Documentation

Complete implementation package for Feedback Friday and Self Promotion Sunday weekly threads.

## 📚 Files

### `IMPLEMENTATION-GUIDE.md`
**Start here!** Complete step-by-step guide for implementing the weekly threads.

- Quick start (15 minutes)
- Expected impact analysis
- Setup instructions
- Monitoring & maintenance schedule
- Troubleshooting
- Success metrics
- Community announcement template

### `reddit-automod-config-CORRECTED.yaml` ⭐ USE THIS ONE

Ready-to-use AutoModerator rules that **remove** posts that should be comments in weekly threads.

**Contains:**
- Feedback request removal → Directs to Feedback Friday thread
- Hiring post removal → Directs to Weekly Hiring Thread (Mondays)
- Self-promo removal → Directs to Self Promotion Sunday thread
- Spam protection (always active)
- Helpful removal messages with clear instructions

**Usage:**
1. Copy entire file contents
2. Go to r/webflow → Mod Tools → Automod
3. Paste at bottom of existing config
4. Save

**How it works:**
- Posts matching patterns are automatically removed
- User receives comment explaining where to post instead
- They post as a comment in the appropriate weekly thread
- Keeps main feed clean and organized

### `reddit-automod-config.yaml` ⚠️ DON'T USE

This was the original version with `~day:` checks that don't work. Kept for reference only. **Use the CORRECTED version above.**

### `AUTOMOD-SYNTAX-FIXES.md`

Explains what was wrong with the original config and how it was fixed. Read this to understand:
- Why day-based filtering doesn't work
- Correct regex syntax
- Difference between `includes` and `includes-word`
- Testing and deployment recommendations

### `reddit-weekly-thread-templates.md`
Templates for the weekly threads and scheduling configuration.

**Contains:**
- Feedback Friday thread template
- Self Promotion Sunday thread template
- Reddit scheduled post configuration
- Setup instructions for automation
- Optional flair system recommendations

**Usage:**
1. Set up scheduled posts in Reddit
2. Use templates for thread content
3. Configure sticky/distinguish settings

### `automod-examples.md`
Real-world examples of how the AutoMod rules work.

**Contains:**
- Removal message examples (what users see)
- False positive examples (what won't be removed)
- Edge cases and exception handling
- Tuning recommendations
- Monitoring schedule

**Usage:**
- Reference when adjusting AutoMod rules
- Share with mod team for consistency
- Use for community education

## 🚀 Quick Implementation

1. Read `IMPLEMENTATION-GUIDE.md`
2. Copy `reddit-automod-config.yaml` → Reddit AutoMod
3. Schedule weekly threads using `reddit-weekly-thread-templates.md`
4. Post community announcement
5. Monitor using `automod-examples.md` as reference

## 📊 Expected Impact

Based on analysis of 994 r/webflow posts:
- **146 posts (14.7%)** redirected to weekly threads
- **6 spam posts (0.6%)** removed entirely
- **848 posts (85.3%)** remain as high-value content
- **Quality improvement:** 5.64 → 5.74 avg (+1.8%)
- **Engagement improvement:** 19.7 → 20.2 avg (+2.5%)

## 🔗 Related

- See `/scripts/analysis/` for data analysis scripts
- See `/data/` for exported post data (not committed to git)
