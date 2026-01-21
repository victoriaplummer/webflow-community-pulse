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

console.log('=== R/WEBFLOW POST INVENTORY ===\n');
console.log(`Total posts in r/webflow: ${webflowPosts.length}`);

// 1. Classification breakdown
const classificationCounts = {};
webflowPosts.forEach(post => {
  const cls = post.classification || 'unclassified';
  classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;
});

console.log('\n--- Classification Breakdown ---');
Object.entries(classificationCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([classification, count]) => {
    const percentage = ((count / webflowPosts.length) * 100).toFixed(1);
    console.log(`${classification.padEnd(20)} ${count.toString().padStart(5)} (${percentage}%)`);
  });

// 2. Topic breakdown
const topicCounts = {};
webflowPosts.forEach(post => {
  const topic = post.topic || 'no_topic';
  topicCounts[topic] = (topicCounts[topic] || 0) + 1;
});

console.log('\n--- Topic Breakdown ---');
Object.entries(topicCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([topic, count]) => {
    const percentage = ((count / webflowPosts.length) * 100).toFixed(1);
    console.log(`${topic.padEnd(20)} ${count.toString().padStart(5)} (${percentage}%)`);
  });

// 3. Quality score distribution
const qualityScores = webflowPosts.filter(p => p.qualityScore).map(p => p.qualityScore);
const avgQuality = qualityScores.length > 0
  ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(2)
  : 'N/A';

const qualityDistribution = {};
qualityScores.forEach(score => {
  qualityDistribution[score] = (qualityDistribution[score] || 0) + 1;
});

console.log('\n--- Quality Score Distribution ---');
console.log(`Posts with quality scores: ${qualityScores.length} / ${webflowPosts.length}`);
console.log(`Average quality score: ${avgQuality}`);
Object.entries(qualityDistribution)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([score, count]) => {
    console.log(`Score ${score}: ${count} posts`);
  });

// 4. Engagement analysis
const engagementScores = webflowPosts.map(p => p.engagementScore || 0);
const avgEngagement = engagementScores.length > 0
  ? (engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length).toFixed(2)
  : 'N/A';

console.log('\n--- Engagement Analysis ---');
console.log(`Average engagement score: ${avgEngagement}`);

const sortedByEngagement = [...webflowPosts].sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));
console.log('\nTop 10 posts by engagement:');
sortedByEngagement.slice(0, 10).forEach((post, i) => {
  console.log(`${i + 1}. [${post.classification}] ${post.title?.substring(0, 60)}... (score: ${post.engagementScore})`);
});

console.log('\nBottom 10 posts by engagement:');
sortedByEngagement.slice(-10).forEach((post, i) => {
  console.log(`${i + 1}. [${post.classification}] ${post.title?.substring(0, 60)}... (score: ${post.engagementScore})`);
});

// 5. Potential clutter identification
console.log('\n--- Potential Clutter Analysis ---');

// Low quality, low engagement
const lowQualityLowEngagement = webflowPosts.filter(p =>
  (p.qualityScore && p.qualityScore <= 3) &&
  (p.engagementScore || 0) < 5
);
console.log(`Low quality + low engagement: ${lowQualityLowEngagement.length} posts`);

// Spam/self-promo
const spam = webflowPosts.filter(p =>
  p.classification === 'spam' || p.classification === 'self_promo'
);
console.log(`Spam/self-promo: ${spam.length} posts`);

// Rants
const rants = webflowPosts.filter(p => p.classification === 'rant');
console.log(`Rants: ${rants.length} posts`);

// Simple questions with low engagement
const simpleQuestions = webflowPosts.filter(p =>
  p.classification === 'question' &&
  (p.qualityScore && p.qualityScore <= 4) &&
  (p.engagementScore || 0) < 3
);
console.log(`Low-quality questions (quality ≤4, engagement <3): ${simpleQuestions.length} posts`);

// 6. High-value content identification
console.log('\n--- High-Value Content Analysis ---');

// High quality showcases
const showcases = webflowPosts.filter(p => p.classification === 'showcase');
const highQualityShowcases = showcases.filter(p => p.qualityScore && p.qualityScore >= 7);
console.log(`Total showcases: ${showcases.length}`);
console.log(`High-quality showcases (≥7): ${highQualityShowcases.length}`);

// Tutorials and resources
const tutorials = webflowPosts.filter(p => p.classification === 'tutorial');
const resources = webflowPosts.filter(p => p.classification === 'resource');
console.log(`Tutorials: ${tutorials.length}`);
console.log(`Resources: ${resources.length}`);

// High engagement discussions
const discussions = webflowPosts.filter(p =>
  p.classification === 'discussion' &&
  (p.engagementScore || 0) >= 10
);
console.log(`High-engagement discussions (≥10): ${discussions.length}`);

// Feedback requests
const feedbackRequests = webflowPosts.filter(p => p.classification === 'feedback_request');
console.log(`Feedback requests: ${feedbackRequests.length}`);

// 7. Flair analysis
const flairCounts = {};
webflowPosts.forEach(post => {
  const flair = post.flair || 'no_flair';
  flairCounts[flair] = (flairCounts[flair] || 0) + 1;
});

console.log('\n--- Flair Distribution ---');
Object.entries(flairCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([flair, count]) => {
    const percentage = ((count / webflowPosts.length) * 100).toFixed(1);
    console.log(`${flair.padEnd(30)} ${count.toString().padStart(5)} (${percentage}%)`);
  });

// 8. Summary
console.log('\n=== MODERATION RECOMMENDATIONS ===\n');
console.log('CLUTTER TO CONSIDER REMOVING:');
console.log(`- ${lowQualityLowEngagement.length} low-quality, low-engagement posts`);
console.log(`- ${spam.length} spam/self-promotional posts`);
console.log(`- ${rants.length} rant posts`);
console.log(`- ${simpleQuestions.length} simple questions with minimal engagement`);
console.log(`Total potential clutter: ${lowQualityLowEngagement.length + spam.length + rants.length + simpleQuestions.length} posts (${((lowQualityLowEngagement.length + spam.length + rants.length + simpleQuestions.length) / webflowPosts.length * 100).toFixed(1)}%)`);

console.log('\nHIGH-VALUE CONTENT TO PROMOTE:');
console.log(`- ${highQualityShowcases.length} high-quality showcases`);
console.log(`- ${tutorials.length} tutorials`);
console.log(`- ${resources.length} resource posts`);
console.log(`- ${discussions.length} high-engagement discussions`);
console.log(`Total high-value posts: ${highQualityShowcases.length + tutorials.length + resources.length + discussions.length} posts (${((highQualityShowcases.length + tutorials.length + resources.length + discussions.length) / webflowPosts.length * 100).toFixed(1)}%)`);
