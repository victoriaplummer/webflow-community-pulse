# AutoMod Syntax Issues & Fixes

## Critical Issue: No Day-Based Filtering

**AutoModerator does NOT support day-based filtering.** The `~day: ["Friday"]` syntax does not exist in the official AutoMod documentation.

### What Doesn't Work

```yaml
# ❌ THIS DOES NOT WORK - day check doesn't exist
~day: ["Friday"]
action: remove
```

### Solutions

Since we can't filter by day, we have two options:

#### Option 1: Filter to Modqueue (RECOMMENDED)

Use `action: filter` to send posts to modqueue for manual review:

```yaml
# ✅ This works - sends to modqueue
action: filter
action_reason: "Feedback request - check if posted on Friday"
modmail: |
    Feedback request detected. If it's Friday, approve it.
```

**Pros:**
- Quick manual review (one click to approve/remove)
- No false positives removing valid posts
- Automated detection + human judgment

**Cons:**
- Requires moderator action
- Small delay before posts go live

#### Option 2: Remove All (NOT RECOMMENDED)

Remove ALL feedback/hiring/promo posts regardless of day:

```yaml
# ⚠️ This works but removes ALL posts
action: remove
```

**Pros:**
- Fully automated
- Forces all posts into weekly threads

**Cons:**
- Removes posts even on correct day
- Users can't post feedback/hiring/promo ANY time
- More restrictive than intended

## Syntax Errors Fixed

### 1. Multi-word phrases with `includes-word`

**Problem:** `includes-word` searches for whole words, not phrases

```yaml
# ❌ WRONG - "looking for" is two words
title (includes-word): ["looking for", "need"]
```

**Fix:** Use `includes` for multi-word phrases

```yaml
# ✅ CORRECT
title (includes): ["looking for", "need a", "seeking"]
```

### 2. Regex escaping in double quotes

**Problem:** Double quotes require double-escaping

```yaml
# ❌ WRONG - needs double escaping
title (regex): ["\\$\\d+"]
```

**Fix:** Use single quotes to avoid double-escaping

```yaml
# ✅ CORRECT
title (regex): ['\$\d+']
```

### 3. Combining modifiers

**Problem:** Incorrect modifier syntax

```yaml
# ❌ WRONG
title+body (regex): ["pattern"]
title+body (includes): ["text"]
```

**Fix:** Combine modifiers with commas

```yaml
# ✅ CORRECT
title+body (regex, includes): ['pattern']
```

### 4. Negation with tilde ~

**Problem:** Tilde placement

```yaml
# ❌ WRONG - tilde goes before field name
title (includes): ["text"]
~: ["webflow"]
```

**Fix:** Tilde before field name

```yaml
# ✅ CORRECT
title (includes): ["text"]
~title (includes): ["webflow"]
```

Or combined:

```yaml
# ✅ ALSO CORRECT
title+body (includes): ["spam text"]
~title+body (includes): ["webflow"]
```

### 5. Flair checking

**Problem:** Wrong modifier

```yaml
# ❌ WRONG - flair_text defaults to full-exact
~flair_text: ["Resource", "Tutorial"]
```

**Fix:** Specify full-exact explicitly

```yaml
# ✅ CORRECT
~flair_text (full-exact): ["Resource", "Tutorial"]
```

## Complete Working Examples

### Feedback Request Filter

```yaml
---
type: submission
title (includes-word): ["feedback", "review", "thoughts"]
body+title (includes): ["my site", "my website", "what do you think"]
action: filter
action_reason: "Feedback request - check if posted on Friday"
modmail: |
    Feedback request detected. Approve if Friday, remove otherwise.
    Post: {{permalink}}
```

### Hiring Post Filter

```yaml
---
type: submission
title (includes): ["looking for", "seeking", "hiring"]
body+title (includes-word): ["developer", "designer", "freelancer"]
action: filter
action_reason: "Hiring post - check if posted on Monday"
```

### Self-Promo Filter

```yaml
---
type: submission
title+body (regex, includes): ['(i will|i\'ll) (make|build|create)']
action: filter
action_reason: "Service offering - check if posted on Sunday"
```

### Spam Removal (Always Active)

```yaml
---
type: submission
title+body (includes): ["90% off", "super promo"]
~title+body (includes): ["webflow"]
action: spam
action_reason: "Unrelated product spam"
```

## Recommended Workflow

1. **Use `reddit-automod-config-CORRECTED.yaml`** - This version uses `filter` action
2. **Set up modqueue workflow:**
   - Monday: Review hiring posts, approve if appropriate
   - Friday: Review feedback requests, approve if appropriate
   - Sunday: Review self-promo posts, approve if appropriate
3. **Create removal macros** with removal reasons that link to weekly threads
4. **Monitor for 2-3 weeks** and adjust keyword triggers as needed

## Testing Your Config

Before deploying:

1. **Check YAML syntax:** Use https://www.yamllint.com/
2. **Test regex patterns:** Use https://regex101.com/ (Python flavor)
3. **Start with `filter`:** Don't use `remove` until you're confident
4. **Review modqueue daily:** For the first week, check removed posts

## Common Mistakes to Avoid

1. ❌ Don't use `~day:` - it doesn't exist
2. ❌ Don't use double quotes with regex - use single quotes
3. ❌ Don't use `includes-word` for multi-word phrases
4. ❌ Don't forget to escape special regex characters: `\$\d+` not `$\d+`
5. ❌ Don't combine `includes` and `includes-word` in same check
6. ✅ DO separate rules with exactly `---` (3 hyphens)
7. ✅ DO use `modmail:` for important filtered posts
8. ✅ DO test on a test subreddit first if possible

## Sources

- [AutoModerator Full Documentation](https://www.reddit.com/r/reddit.com/wiki/automoderator/full-documentation/)
- [Reddit Mods Help - AutoModerator](https://mods.reddithelp.com/hc/en-us/articles/360002561632-AutoModerator)
- [Regex Testing - regex101.com](https://regex101.com/)
