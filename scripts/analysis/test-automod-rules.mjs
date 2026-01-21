import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the export data
const exportData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/dev-export.json'), 'utf-8'));
const contentItems = exportData.data.content_items || [];

// Filter for r/webflow posts only
const webflowPosts = contentItems.filter(item =>
  item.subreddit === 'webflow' && item.type === 'post'
);

console.log('=== AUTOMOD IMPACT ANALYSIS ===\n');
console.log(`Testing AutoMod rules against ${webflowPosts.length} r/webflow posts\n`);

// Simulate AutoMod rules
const results = {
  feedbackFriday: [],
  selfPromoSunday: [],
  spam: [],
  allowed: []
};

// Keywords for detection (simplified from AutoMod regex)
const feedbackKeywords = ['feedback', 'review', 'thoughts', 'rate', 'critique', 'opinions', 'roast', 'brutal', 'honest'];
const feedbackPhrases = ['my site', 'my website', 'my portfolio', 'my project', 'my design', 'what do you think', 'how does this look'];

const hiringKeywords = ['hiring', 'looking for', 'need', 'seeking'];
const serviceKeywords = ['available', 'i will', "i'll", 'offering', 'services', 'expert', 'specialist', 'for hire'];
const salesKeywords = ['for sale', 'selling', '% off', 'discount', 'limited time', 'promo', 'deal'];

const spamKeywords = ['perplexity ai', 'chatgpt pro', '90% off', '95% off', 'super promo'];
const accountSaleKeywords = ['account', 'balance'];

webflowPosts.forEach(post => {
  const titleLower = (post.title || '').toLowerCase();
  const bodyLower = (post.body || '').toLowerCase();
  const combined = titleLower + ' ' + bodyLower;

  // SPAM DETECTION (always remove)
  if (spamKeywords.some(kw => combined.includes(kw)) && !combined.includes('webflow')) {
    results.spam.push({
      title: post.title,
      classification: post.classification,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Unrelated product spam'
    });
    return;
  }

  if (accountSaleKeywords.every(kw => combined.includes(kw)) && combined.includes('sale')) {
    results.spam.push({
      title: post.title,
      classification: post.classification,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Account selling'
    });
    return;
  }

  if ((titleLower.includes('$5') || titleLower.includes('$10')) && titleLower.includes('will')) {
    results.spam.push({
      title: post.title,
      classification: post.classification,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Low-effort spam'
    });
    return;
  }

  // FEEDBACK FRIDAY DETECTION
  if (post.classification === 'feedback_request') {
    results.feedbackFriday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Classification: feedback_request'
    });
    return;
  }

  const hasFeedbackKeyword = feedbackKeywords.some(kw => titleLower.includes(kw));
  const hasFeedbackPhrase = feedbackPhrases.some(phrase => combined.includes(phrase));

  if (hasFeedbackKeyword && hasFeedbackPhrase) {
    results.feedbackFriday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Feedback keywords detected'
    });
    return;
  }

  // SELF PROMOTION SUNDAY DETECTION
  if (post.classification === 'spam' || post.classification === 'self_promo') {
    // Exception for high-quality self-promo
    if (post.qualityScore >= 7 && (post.engagementScore || 0) >= 20) {
      results.allowed.push({
        title: post.title,
        classification: post.classification,
        quality: post.qualityScore,
        engagement: post.engagementScore,
        reason: 'High-quality self-promo exception'
      });
      return;
    }

    results.selfPromoSunday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: `Classification: ${post.classification}`
    });
    return;
  }

  // Hiring posts
  const hasHiringKeyword = hiringKeywords.some(kw => titleLower.includes(kw));
  const hasDeveloperKeyword = combined.includes('developer') || combined.includes('designer') || combined.includes('freelancer');

  if (hasHiringKeyword && hasDeveloperKeyword) {
    results.selfPromoSunday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Hiring post detected'
    });
    return;
  }

  // Service offerings
  const hasServiceKeyword = serviceKeywords.some(kw => combined.includes(kw));
  if (hasServiceKeyword && (titleLower.includes('webflow') || bodyLower.includes('webflow'))) {
    // Check if it's a "giving back" post (quality >= 6)
    if (post.qualityScore >= 6 && combined.includes('free')) {
      results.allowed.push({
        title: post.title,
        classification: post.classification,
        quality: post.qualityScore,
        engagement: post.engagementScore,
        reason: 'High-quality free offer exception'
      });
      return;
    }

    results.selfPromoSunday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Service offering detected'
    });
    return;
  }

  // Sales/Templates
  const hasSalesKeyword = salesKeywords.some(kw => combined.includes(kw));
  if (hasSalesKeyword && !['resource', 'tutorial', 'announcement'].includes(post.classification)) {
    results.selfPromoSunday.push({
      title: post.title,
      quality: post.qualityScore,
      engagement: post.engagementScore,
      reason: 'Sales/promo detected'
    });
    return;
  }

  // If we got here, the post would be allowed
  results.allowed.push({
    title: post.title,
    classification: post.classification,
    quality: post.qualityScore,
    engagement: post.engagementScore,
    reason: 'Allowed'
  });
});

// Print results
console.log('=== REMOVAL SUMMARY ===\n');
console.log(`📧 Feedback Friday redirects: ${results.feedbackFriday.length} posts`);
console.log(`💼 Self Promo Sunday redirects: ${results.selfPromoSunday.length} posts`);
console.log(`🚫 Spam removals: ${results.spam.length} posts`);
console.log(`✅ Allowed posts: ${results.allowed.length} posts`);
console.log(`\nTotal removals: ${results.feedbackFriday.length + results.selfPromoSunday.length + results.spam.length} (${((results.feedbackFriday.length + results.selfPromoSunday.length + results.spam.length) / webflowPosts.length * 100).toFixed(1)}%)\n`);

// Detailed breakdowns
console.log('\n=== FEEDBACK FRIDAY REDIRECTS (Sample) ===');
results.feedbackFriday.slice(0, 15).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.quality}, Engagement: ${post.engagement}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Reason: ${post.reason}`);
});

console.log('\n\n=== SELF PROMO SUNDAY REDIRECTS (Sample) ===');
results.selfPromoSunday.slice(0, 15).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.quality}, Engagement: ${post.engagement}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Reason: ${post.reason}`);
});

console.log('\n\n=== SPAM REMOVALS (All) ===');
results.spam.forEach((post, i) => {
  console.log(`\n${i + 1}. [${post.classification}] Quality: ${post.quality}, Engagement: ${post.engagement}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Reason: ${post.reason}`);
});

console.log('\n\n=== HIGH-QUALITY EXCEPTIONS (Allowed despite self-promo) ===');
const exceptions = results.allowed.filter(p => p.reason.includes('exception'));
exceptions.forEach((post, i) => {
  console.log(`\n${i + 1}. [${post.classification}] Quality: ${post.quality}, Engagement: ${post.engagement}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Reason: ${post.reason}`);
});

// Impact metrics
console.log('\n\n=== IMPACT METRICS ===\n');

const feedbackAvgEngagement = results.feedbackFriday.reduce((sum, p) => sum + (p.engagement || 0), 0) / results.feedbackFriday.length;
const selfPromoAvgEngagement = results.selfPromoSunday.reduce((sum, p) => sum + (p.engagement || 0), 0) / results.selfPromoSunday.length;
const allowedAvgEngagement = results.allowed.reduce((sum, p) => sum + (p.engagement || 0), 0) / results.allowed.length;

console.log(`Feedback Friday posts - Avg engagement: ${feedbackAvgEngagement.toFixed(1)}`);
console.log(`Self Promo Sunday posts - Avg engagement: ${selfPromoAvgEngagement.toFixed(1)}`);
console.log(`Allowed posts - Avg engagement: ${allowedAvgEngagement.toFixed(1)}`);

const feedbackAvgQuality = results.feedbackFriday.reduce((sum, p) => sum + (p.quality || 0), 0) / results.feedbackFriday.length;
const selfPromoAvgQuality = results.selfPromoSunday.reduce((sum, p) => sum + (p.quality || 0), 0) / results.selfPromoSunday.length;
const allowedAvgQuality = results.allowed.reduce((sum, p) => sum + (p.quality || 0), 0) / results.allowed.length;

console.log(`\nFeedback Friday posts - Avg quality: ${feedbackAvgQuality.toFixed(1)}`);
console.log(`Self Promo Sunday posts - Avg quality: ${selfPromoAvgQuality.toFixed(1)}`);
console.log(`Allowed posts - Avg quality: ${allowedAvgQuality.toFixed(1)}`);

console.log('\n\n=== CONCLUSION ===\n');
console.log(`By implementing Feedback Friday and Self Promotion Sunday:`);
console.log(`- ${results.feedbackFriday.length + results.selfPromoSunday.length} posts would be consolidated into weekly threads`);
console.log(`- ${results.spam.length} spam posts would be removed entirely`);
console.log(`- ${results.allowed.length} high-value posts would remain visible`);
console.log(`- Feed quality would increase from ${(webflowPosts.reduce((sum, p) => sum + p.qualityScore, 0) / webflowPosts.length).toFixed(2)} to ${allowedAvgQuality.toFixed(2)} avg quality`);
console.log(`- Feed engagement would increase from ${(webflowPosts.reduce((sum, p) => sum + (p.engagementScore || 0), 0) / webflowPosts.length).toFixed(1)} to ${allowedAvgEngagement.toFixed(1)} avg engagement`);
