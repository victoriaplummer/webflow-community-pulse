# Feedback Friday & Self Promotion Sunday - Implementation Guide

## 📊 Expected Impact

Based on analysis of 994 r/webflow posts:

### Content Consolidation
- **146 posts (14.7%) would be redirected** to weekly threads
- **6 spam posts (0.6%) would be removed** entirely
- **848 posts (85.3%) would remain** as standalone posts

### Quality Improvements
- **Feed quality:** 5.64 → 5.74 avg (+1.8%)
- **Feed engagement:** 19.7 → 20.2 avg (+2.5%)
- **Signal-to-noise ratio:** Significantly improved

### Breakdown
- 📧 **Feedback Friday:** 36 posts consolidated
- 💼 **Self Promotion Sunday:** 104 posts consolidated
- ✅ **High-quality exceptions:** 6 self-promo posts allowed (quality ≥7, engagement ≥20)

---

## 🚀 Quick Start (15 minutes)

### Step 1: Add AutoMod Rules (5 min)
1. Go to r/webflow → **Mod Tools** → **Automod**
2. Copy contents from `reddit-automod-config.yaml`
3. Paste at the bottom of your AutoMod config
4. Click **Save**
5. Test with a test post

### Step 2: Schedule Weekly Threads (5 min)
1. Go to **Mod Tools** → **Automation** → **Scheduled Posts**
2. Create new scheduled post:
   - **Feedback Friday:** Every Friday 9:00 AM
   - Use template from `reddit-weekly-thread-templates.md`
   - Set `sticky: true` and `distinguish: true`
3. Create new scheduled post:
   - **Self Promotion Sunday:** Every Sunday 9:00 AM
   - Use template from `reddit-weekly-thread-templates.md`
   - Set `sticky: true` and `distinguish: true`

### Step 3: Update Subreddit Rules (5 min)
1. Go to **Mod Tools** → **Rules and regulations**
2. Add new rule: "Feedback requests must go in Feedback Friday thread"
3. Add new rule: "Self-promotion must go in Self Promotion Sunday thread"
4. Update sidebar/wiki with links to current weekly threads
5. Create announcement post explaining new system

---

## 📋 Files Included

1. **`reddit-automod-config.yaml`**
   - Complete AutoMod rules for both weekly threads
   - Spam protection rules
   - Removal message templates

2. **`reddit-weekly-thread-templates.md`**
   - Feedback Friday post template
   - Self Promotion Sunday post template
   - Scheduling configuration

3. **`automod-examples.md`**
   - Examples of how removals will appear to users
   - False positive examples (what won't get removed)
   - Tuning recommendations

4. **`test-automod-rules.mjs`**
   - Script to test rules against existing posts
   - Shows impact analysis and metrics

---

## 🎯 What Gets Redirected

### Feedback Friday (36 posts)
✅ Posts with titles like:
- "Thoughts on my portfolio?"
- "Rate my website"
- "Feedback on my design"
- "Brutal critique please"
- "How does this look?"

❌ Exceptions (allowed as standalone):
- Completed showcases (not asking for feedback)
- Tutorial posts explaining implementation
- Technical deep-dives with substantial content

### Self Promotion Sunday (104 posts)
✅ Posts like:
- "Webflow developer available for hire"
- "[Hiring] Looking for Webflow specialist"
- "50% off Webflow templates"
- "I built this tool - check it out!"
- "Offering Webflow services"

❌ Exceptions (allowed as standalone):
- High-quality tool launches (quality ≥7, engagement ≥20)
- Genuinely free resources with no catches
- Detailed tutorials (even if promoting own content)
- Major announcements with community value

### Always Removed (6 posts)
🚫 Spam:
- Unrelated product promotions
- Account selling (violates ToS)
- Extremely low-effort offers ("$5 websites")
- Scams and malicious content

---

## 📅 Launch Timeline

### Week 1: Soft Launch
- Activate AutoMod rules
- Post first weekly threads manually
- Monitor removals closely
- Manually approve false positives
- Gather community feedback

### Week 2-3: Tuning
- Adjust AutoMod keywords based on false positives
- Refine removal messages
- Update weekly thread templates
- Check engagement in weekly threads

### Week 4+: Steady State
- Trust the system
- Spot-check removals weekly
- Monthly review of metrics
- Adjust rules as community evolves

---

## 🛠️ Monitoring & Maintenance

### Daily (First 2 Weeks)
- Check modqueue for removed posts
- Manually approve false positives
- Note any pattern of incorrect removals

### Weekly
- Review engagement in weekly threads
- Check if threads need to be stickied
- Respond to modmail about removals

### Monthly
- Run impact analysis script
- Review removal statistics
- Adjust AutoMod rules if needed
- Survey community satisfaction

---

## ❓ FAQ for Users

### "Why was my post removed?"
Your post was automatically redirected because it fits better in one of our weekly megathreads:
- **Feedback requests** → Feedback Friday
- **Self-promotion** → Self Promotion Sunday

This keeps the subreddit organized and ensures everyone gets equal visibility.

### "My post isn't self-promotion!"
If you believe your post was incorrectly removed, please:
1. Read the removal message carefully
2. Check if your post fits the exception criteria
3. Reply to the AutoMod comment or message the moderators
4. We'll review and approve if appropriate

### "Can I post my tutorial on Thursday?"
Yes! High-quality educational content is welcome anytime:
- Use "Tutorial" flair
- Focus on teaching, not promoting
- Include substantial text summary
- Show code/implementation details

### "When do the weekly threads post?"
- **Feedback Friday:** Every Friday at 9:00 AM
- **Self Promotion Sunday:** Every Sunday at 9:00 AM
- Threads remain stickied for 24 hours
- Previous threads are archived in the wiki

---

## 🔧 Troubleshooting

### False Positives (Good posts removed)
**Problem:** Legitimate showcase removed as feedback request

**Solution:** Add exception to AutoMod:
```yaml
~title (includes): ["showcase", "built", "created", "made"]
```

### False Negatives (Spam getting through)
**Problem:** Self-promo posts evading detection

**Solution:** Add more keywords to AutoMod patterns, lower quality thresholds

### Low Thread Engagement
**Problem:** Weekly threads aren't getting activity

**Solution:**
- Promote threads in sidebar
- Pin threads longer (48 hours instead of 24)
- Seed threads with example posts
- Consider relaxing enforcement temporarily

### Too Restrictive
**Problem:** Community complains rules are too strict

**Solution:**
- Raise quality threshold for exceptions (≥6 instead of ≥7)
- Allow more "giving back" posts
- Create additional exception categories
- Survey community preferences

---

## 📈 Success Metrics

Track these weekly:
- Number of posts redirected
- Weekly thread comment count
- Community sentiment (modmail tone)
- False positive rate
- Spam caught rate

**Good targets:**
- Weekly threads: 10+ comments each
- False positives: <5% of removals
- Community complaints: <2 per week
- Spam catch rate: >95%

---

## 🎉 Community Announcement Template

Post this when launching:

```markdown
# 🎉 New Weekly Threads: Feedback Friday & Self Promotion Sunday

Hey r/webflow! We're launching two new weekly megathreads to keep our subreddit organized and high-quality:

## 📧 Feedback Friday
Every Friday, share your projects and get constructive feedback from the community. All feedback requests will now go in this weekly thread.

## 💼 Self Promotion Sunday
Every Sunday, promote your services, tools, templates, or job opportunities. All self-promotional content will now go in this weekly thread.

## Why are we doing this?
- Prevents feed clutter from repetitive post types
- Ensures everyone gets equal visibility
- Makes high-value content easier to discover
- Keeps discussions organized in one place

## What if my post gets removed?
AutoMod will redirect you to the appropriate weekly thread with clear instructions. High-quality educational content and completed showcases are still welcome anytime!

## When does this start?
**This Friday!** Look for the first Feedback Friday thread.

Questions? Feedback? Let us know below!
```

---

## 📞 Support

If you need help implementing:
1. Check `automod-examples.md` for common scenarios
2. Test with `test-automod-rules.mjs` script
3. Review Reddit's AutoMod documentation
4. Start with soft enforcement, gradually increase

Good luck! 🚀
