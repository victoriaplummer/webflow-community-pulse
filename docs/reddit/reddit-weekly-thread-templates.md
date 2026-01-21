# Weekly Thread Templates for r/webflow

## About Date Placeholders

All templates use Reddit's date placeholder format: `{{date %B %d, %Y}}`

- **Format:** Uses Python's strftime() formatting
- **Example:** `{{date %B %d, %Y}}` displays as "January 27, 2026"
- **Timezone:** UTC by default
- **Offsets:** Use `{{date+6 %B %d}}` for 6 days ahead, `{{date-3 %B %d}}` for 3 days before

Common formats:
- `%B` = Full month name (January)
- `%b` = Abbreviated month (Jan)
- `%d` = Day of month (01-31)
- `%Y` = 4-digit year (2026)
- `%y` = 2-digit year (26)

---

## Weekly Hiring Thread Template (Mondays)

**Title:** `Weekly Hiring Thread - {{date %B %d, %Y}}`

**Post Body:**

```markdown
# 💼 Weekly Hiring Thread - {{date %B %d, %Y}}

Welcome to our weekly hiring thread! This is the place for all job postings, freelance opportunities, and "looking for developer/designer" posts.

## 👔 For Employers & Clients

Post your opportunities here with:
- **Role title** - Be specific (e.g., "Webflow Developer - Ecommerce Focus")
- **Type** - Freelance, contract, full-time, part-time
- **Location** - On-site, remote, hybrid
- **Required skills** - What must they know?
- **Nice-to-haves** - Bonus skills
- **Rate/Salary** - Range if possible (helps everyone)
- **How to apply** - DM, email, application link

## 🎨 For Freelancers & Job Seekers

Post your availability with:
- **Your skills** - What you specialize in
- **Experience level** - Years, notable projects
- **Availability** - Full-time, part-time, project-based
- **Rate range** - Helps set expectations
- **Portfolio link** - Show your work
- **Contact method** - How should people reach you

## 📝 Posting Tips

**Good Example (Employer):**
```
[HIRING] Webflow Developer for SaaS Dashboard - Remote

We're building a B2B SaaS product and need an experienced Webflow developer for a 3-month contract.

Requirements:
- 2+ years Webflow experience
- Strong JavaScript/custom code skills
- Experience with CMS and dynamic content
- Bonus: Memberstack or similar auth systems

Rate: $50-75/hr depending on experience
Apply: jobs@ourcompany.com
```

**Good Example (Freelancer):**
```
[AVAILABLE] Webflow Developer - 20hrs/week

5+ years building Webflow sites, specializing in:
- Complex CMS structures
- Custom interactions & animations
- API integrations (Zapier, Make, custom)

Recent work: [portfolio link]
Rate: $65/hr
Contact: DM or email@example.com
```

## 🚫 What Doesn't Belong Here

- Feedback requests (wait for Feedback Friday)
- Promoting your tools/templates (wait for Self Promotion Sunday)
- General questions (make a regular post)

---

**Sort by New** to see the latest opportunities!

Previous hiring threads: [Link to wiki/archive]
```

---

## Feedback Friday Thread Template

**Title:** `Feedback Friday - {{date %B %d, %Y}}`

**Post Body:**

```markdown
# 🎨 Feedback Friday - {{date %B %d, %Y}}

Welcome to our weekly Feedback Friday thread! This is the place to share your Webflow projects and get constructive feedback from the community.

## 📋 Guidelines

**When sharing your project:**
- Include a link to your live site
- Specify what type of feedback you're looking for (design, UX, performance, code structure, etc.)
- Provide context: Is this a client project? Personal portfolio? Learning experiment?
- Be specific about areas you're uncertain about

**When giving feedback:**
- Be constructive and specific
- Point out what works well, not just what needs improvement
- If you suggest changes, explain why
- Remember: everyone's at a different skill level

## 💡 Tips for Better Feedback

- **Desktop + Mobile:** Test on both if possible
- **Lighthouse scores:** Run a quick audit and share results
- **Interactions:** Call out any animations or scroll effects to review
- **CMS:** Let us know if you're showcasing dynamic content

## 🚫 What Doesn't Belong Here

- Completed showcases (make a standalone post!)
- Job posts (wait for Monday's Hiring Thread)
- Promoting services/tools (wait for Self Promotion Sunday)

---

**Sort by New** to see the latest submissions and help fellow designers get feedback!

Previous Feedback Friday threads: [Link to wiki/archive]
```

---

## Self Promotion Sunday Thread Template

**Title:** `Self Promotion Sunday - {{date %B %d, %Y}}`

**Post Body:**

```markdown
# 🎉 Self Promotion Sunday - {{date %B %d, %Y}}

Welcome to our weekly Self Promotion Sunday thread! This is the place for self-promotional content that benefits the Webflow community.

## ✅ What's Allowed Here

**For Service Providers:**
- "Available for hire" posts
- Freelance/agency services
- Skill swaps or collaboration requests
- Portfolio showcases (when promoting yourself)

**For Tool Builders:**
- Webflow apps, plugins, or extensions you've built
- Templates or cloneable components (free or paid)
- SaaS tools for Webflow users
- Chrome extensions or developer tools

**For Content Creators:**
- Your YouTube tutorials or channel
- Blog posts or articles you've written
- Courses or educational content
- Podcasts or live streams

**For Everyone:**
- Discounts or deals you're offering
- Community resources you maintain
- Side projects built with Webflow
- Templates or component libraries

## 📝 Posting Tips

**Make it compelling:**
- Clear title describing what you're sharing
- Brief description of what it does/offers
- Who it's for (beginners, advanced, agencies, etc.)
- Pricing (if applicable) or "Free/Open Source"
- Demo link or screenshots
- How to get it

**For Services:**
- Your specialties and experience level
- Rate range or "DM for quote"
- Portfolio samples
- Availability and lead time

## 🎬 Content Creators

YouTube videos, blogs, and tutorials are **always welcome** as standalone posts during the week! Use proper flair:
- Tutorials → "Tutorial" flair + descriptive title
- Showcases → "Showcase" flair + explain your build

Only use this thread if you're specifically promoting your channel/brand.

## 🚫 What STILL Isn't Allowed

- Spam or completely unrelated products
- Selling Webflow accounts (violates ToS)
- Job postings (use Monday's Hiring Thread)
- Feedback requests (use Friday's thread)

## 🤝 Community Guidelines

- Be respectful and professional
- Don't spam multiple comments with the same offer
- Upvote offerings you find valuable
- If you try someone's tool/service, leave them feedback!

---

**Sort by New** to see the latest offerings!

Previous Self Promotion Sunday threads: [Link to wiki/archive]
```

---

## Reddit AutoModerator Schedule Configuration

To automatically post these weekly threads, add this to your subreddit's scheduled posts (Mod Tools → Automation → Scheduled Posts):

### Weekly Hiring Thread Schedule

```yaml
first: "2026-01-27 09:00:00"  # First Monday to start
repeat: 1 week
sticky: true
distinguish: true
title: "Weekly Hiring Thread - {{date %B %d, %Y}}"
text: |
    # 💼 Weekly Hiring Thread - {{date %B %d, %Y}}

    Welcome to our weekly hiring thread! This is the place for all job postings, freelance opportunities, and "looking for developer/designer" posts.

    [Use the full template from above]
```

### Feedback Friday Schedule

```yaml
first: "2026-01-24 09:00:00"  # First Friday to start
repeat: 1 week
sticky: true
distinguish: true
title: "Feedback Friday - {{date %B %d, %Y}}"
text: |
    # 🎨 Feedback Friday - {{date %B %d, %Y}}

    Welcome to our weekly Feedback Friday thread! This is the place to share your Webflow projects and get constructive feedback from the community.

    [Use the full template from above]
```

### Self Promotion Sunday Schedule

```yaml
first: "2026-01-26 09:00:00"  # First Sunday to start
repeat: 1 week
sticky: true
distinguish: true
title: "Self Promotion Sunday - {{date %B %d, %Y}}"
text: |
    # 🎉 Self Promotion Sunday - {{date %B %d, %Y}}

    Welcome to our weekly Self Promotion Sunday thread! This is the place for self-promotional content that benefits the Webflow community.

    [Use the full template from above]
```

---

## Setup Instructions

1. **Add AutoMod Rules:**
   - Go to r/webflow Mod Tools → Automod
   - Paste the rules from `reddit-automod-config.yaml`
   - Save and test with a test post

2. **Schedule Weekly Threads:**
   - Go to Mod Tools → Automation → Scheduled Posts
   - Create "Weekly Hiring Thread" scheduled post (every Monday 9am)
   - Create "Feedback Friday" scheduled post (every Friday 9am)
   - Create "Self Promotion Sunday" scheduled post (every Sunday 9am)
   - Set all to sticky: true

3. **Create Removal Reasons:**
   - Go to Mod Tools → Removal Reasons
   - Add "Hiring Thread redirect"
   - Add "Feedback Friday redirect"
   - Add "Self Promotion Sunday redirect"
   - Link to the AutoMod templates

4. **Update Subreddit Rules:**
   - Add rule: "Feedback requests must go in Feedback Friday thread"
   - Add rule: "Job postings must go in Weekly Hiring Thread (Mondays)"
   - Add rule: "Self-promotion must go in Self Promotion Sunday thread"
   - Link to weekly threads in sidebar/wiki

5. **Test Period:**
   - Run for 4 weeks
   - Monitor removed posts
   - Adjust keyword triggers based on false positives
   - Gather community feedback

---

## Weekly Schedule Summary

- **Monday:** Weekly Hiring Thread (sticky 24hrs)
- **Tuesday-Thursday:** Regular content only
- **Friday:** Feedback Friday (sticky 24hrs)
- **Saturday:** Regular content only
- **Sunday:** Self Promotion Sunday (sticky 24hrs)

**Always allowed:**
- Tutorials and educational content
- Completed showcases (not asking for feedback)
- Technical questions and discussions
- Community discussions
- High-quality blog posts and YouTube videos

---

## Optional: Flair System

Consider adding post flairs that AutoMod can check:

- **"Feedback Request"** → Auto-removed except Friday
- **"Hiring"** → Auto-removed except Monday
- **"Self Promotion"** → Auto-removed except Sunday
- **"Showcase"** → Allowed anytime (completed work, not feedback requests)
- **"Tutorial"** → Allowed anytime (educational content)
- **"Resource"** → Allowed anytime (free tools/resources)
- **"Question"** → Allowed anytime (help requests)
- **"Discussion"** → Allowed anytime (community topics)

This gives users a clear signal about where their post belongs.
