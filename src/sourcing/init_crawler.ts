#!/usr/bin/env node
/**
 * Crawler Script
 * 
 * Usage:
 *   npm run crawl -- <url>
 *   or
 *   ts-node src/scripts/runCrawler.ts <url>
 */

import { Crawler } from '../sourcing/crawler';

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('❌ Error: Please provide a URL to crawl');
    console.error('Usage: npm run crawl -- <url>');
    console.error('   or: ts-node src/scripts/runCrawler.ts <url>');
    process.exit(1);
  }

  console.log(`🚀 Starting crawl from: ${url}\n`);

  const crawler = new Crawler({
    maxDepth: 5,  // Adjust as needed
    delay: 1000   // 1 second delay between requests
  });

  try {
    await crawler.crawl(url);
    const stats = crawler.getStats();
    console.log(`\n📊 Statistics:`);
    console.log(`   Visited URLs: ${stats.visitedUrls}`);
    console.log(`   Output file: event_links.txt`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Crawl failed:');
    console.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:');
  console.error(error);
  process.exit(1);
});
