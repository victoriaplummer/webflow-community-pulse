#!/usr/bin/env node
/**
 * Generate SQL INSERT statements from exported data
 * Bypasses Worker limits by running SQL directly on D1
 *
 * Usage:
 *   node scripts/generate-sql.js data/export.json > sync.sql
 *   wrangler d1 execute DB --file=sync.sql --remote
 */

import fs from 'fs';

const dataFile = process.argv[2];

if (!dataFile) {
  console.error('Usage: node scripts/generate-sql.js <export-file.json> > sync.sql');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Helper to escape SQL strings
function escape(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Helper to generate INSERT OR IGNORE statement
function generateInsert(tableName, records) {
  if (!records || records.length === 0) return '';

  const columns = Object.keys(records[0]);
  let sql = '';

  // Generate INSERT statements in batches
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    sql += `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')})\nVALUES\n`;

    const values = batch.map(record => {
      const vals = columns.map(col => escape(record[col]));
      return `  (${vals.join(', ')})`;
    });

    sql += values.join(',\n');
    sql += ';\n\n';
  }

  return sql;
}

// Generate SQL for each table
console.log('-- Generated SQL for data sync');
console.log(`-- Generated at: ${new Date().toISOString()}`);
console.log('-- Using INSERT OR IGNORE to skip duplicates\n');

console.log('BEGIN TRANSACTION;\n');

if (data.authors) {
  console.log(`-- Authors (${data.authors.length} records)`);
  console.log(generateInsert('authors', data.authors));
}

if (data.content_items) {
  console.log(`-- Content Items (${data.content_items.length} records)`);
  console.log(generateInsert('content_items', data.content_items));
}

if (data.engagement_snapshots) {
  console.log(`-- Engagement Snapshots (${data.engagement_snapshots.length} records)`);
  console.log(generateInsert('engagement_snapshots', data.engagement_snapshots));
}

if (data.insight_generations) {
  console.log(`-- Insight Generations (${data.insight_generations.length} records)`);
  console.log(generateInsert('insight_generations', data.insight_generations));
}

if (data.insights) {
  console.log(`-- Insights (${data.insights.length} records)`);
  console.log(generateInsert('insights', data.insights));
}

if (data.roundups) {
  console.log(`-- Roundups (${data.roundups.length} records)`);
  console.log(generateInsert('roundups', data.roundups));
}

if (data.roundup_items) {
  console.log(`-- Roundup Items (${data.roundup_items.length} records)`);
  console.log(generateInsert('roundup_items', data.roundup_items));
}

console.log('COMMIT;');
