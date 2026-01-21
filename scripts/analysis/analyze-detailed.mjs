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

console.log('=== DETAILED CLUTTER ANALYSIS ===\n');

// 1. Spam/Self-Promo Examples
const spamSelfPromo = webflowPosts.filter(p =>
  p.classification === 'spam' || p.classification === 'self_promo'
);

console.log('--- Spam & Self-Promotional Posts (106 total) ---');
console.log('Examples:');
spamSelfPromo.slice(0, 15).forEach((post, i) => {
  console.log(`\n${i + 1}. [${post.classification}] Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
  if (post.summary) {
    console.log(`   Summary: ${post.summary.substring(0, 150)}...`);
  }
});

// 2. Rant Examples
const rants = webflowPosts.filter(p => p.classification === 'rant');

console.log('\n\n--- Rant Posts (33 total) ---');
console.log('Examples (sorted by engagement):');
rants.sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)).slice(0, 10).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});

// 3. Low Quality, Low Engagement Posts
const lowQualityLowEngagement = webflowPosts.filter(p =>
  (p.qualityScore && p.qualityScore <= 3) &&
  (p.engagementScore || 0) < 5
);

console.log('\n\n--- Low Quality + Low Engagement Posts (11 total) ---');
lowQualityLowEngagement.forEach((post, i) => {
  console.log(`\n${i + 1}. [${post.classification}] Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
  if (post.summary) {
    console.log(`   Summary: ${post.summary}`);
  }
});

// 4. High-Value Content Examples
console.log('\n\n=== HIGH-VALUE CONTENT EXAMPLES ===\n');

// High-quality showcases
const showcases = webflowPosts.filter(p =>
  p.classification === 'showcase' &&
  p.qualityScore && p.qualityScore >= 7
);

console.log('--- High-Quality Showcases (17 total) ---');
showcases.sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)).slice(0, 10).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
  if (post.showcaseUrl) {
    console.log(`   URL: ${post.showcaseUrl}`);
  }
});

// Tutorials
const tutorials = webflowPosts.filter(p => p.classification === 'tutorial');

console.log('\n\n--- Tutorial Posts (13 total) ---');
tutorials.forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});

// High-engagement discussions
const discussions = webflowPosts.filter(p =>
  p.classification === 'discussion' &&
  (p.engagementScore || 0) >= 10
);

console.log('\n\n--- High-Engagement Discussions (46 total) ---');
discussions.sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)).slice(0, 15).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});

// Top resources
const resources = webflowPosts.filter(p => p.classification === 'resource');

console.log('\n\n--- Resource Posts (123 total) ---');
console.log('Top 15 by engagement:');
resources.sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)).slice(0, 15).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});

// 5. Question Analysis
const questions = webflowPosts.filter(p => p.classification === 'question');
const highQualityQuestions = questions.filter(p => p.qualityScore && p.qualityScore >= 7);
const mediumQualityQuestions = questions.filter(p => p.qualityScore && p.qualityScore >= 5 && p.qualityScore < 7);
const lowQualityQuestions = questions.filter(p => p.qualityScore && p.qualityScore < 5);

console.log('\n\n=== QUESTION ANALYSIS ===');
console.log(`Total questions: ${questions.length} (53% of all posts)`);
console.log(`High quality (≥7): ${highQualityQuestions.length}`);
console.log(`Medium quality (5-6): ${mediumQualityQuestions.length}`);
console.log(`Low quality (<5): ${lowQualityQuestions.length}`);

console.log('\n--- High-Quality Questions (Examples) ---');
highQualityQuestions.sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0)).slice(0, 10).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});

console.log('\n--- Low-Quality Questions (Examples) ---');
lowQualityQuestions.sort((a, b) => (a.engagementScore || 0) - (b.engagementScore || 0)).slice(0, 10).forEach((post, i) => {
  console.log(`\n${i + 1}. Quality: ${post.qualityScore}, Engagement: ${post.engagementScore}`);
  console.log(`   Title: ${post.title}`);
  console.log(`   Topic: ${post.topic}`);
});
