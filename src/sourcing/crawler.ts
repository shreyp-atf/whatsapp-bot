import * as cheerio from 'cheerio';
import { URL } from 'url';
import { appendFileSync } from 'fs';
import { join } from 'path';

export interface CrawlOptions {
  maxDepth?: number;
  delay?: number; // Delay between requests in milliseconds
}

export class Crawler {
  private visitedUrls: Set<string> = new Set();
  private options: Required<CrawlOptions>;
  private outputFile: string;

  constructor(options: CrawlOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 3,
      delay: options.delay ?? 1000, // Default 1000ms delay (1 request per second)
    };
    // Set output file path
    this.outputFile = join(process.cwd(), 'event_links.txt');
  }

  /**
   * Main entry point to start crawling from a starter URL
   */
  async crawl(startUrl: string): Promise<void> {
    this.visitedUrls.clear();

    try {
      const normalizedStartUrl = this.normalizeUrl(startUrl, startUrl);
      
      if (!normalizedStartUrl) {
        throw new Error(`Invalid start URL: ${startUrl}`);
      }
      
      await this.crawlPage(normalizedStartUrl, 0);
      
      console.log(`\n✅ Crawl complete. Visited ${this.visitedUrls.size} URLs.`);
    } catch (error) {
      console.error(`Error during crawl: ${error}`);
      throw error;
    }
  }

  /**
   * Recursively crawl a page up to maxDepth
   */
  private async crawlPage(url: string, depth: number): Promise<void> {
    // Skip if we've already visited this URL
    if (this.visitedUrls.has(url)) {
      return;
    }

    // Skip if we've exceeded max depth
    if (depth > this.options.maxDepth) {
      return;
    }

    // Check if we should crawl this URL
    if (!this.shouldCrawl(url)) {
      return;
    }

    // Mark as visited and write to file
    this.visitedUrls.add(url);
    appendFileSync(this.outputFile, url + '\n', 'utf-8');
    console.log(`[Depth ${depth}] Crawling: ${url}`);

    try {
      // Fetch the page HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract links from the page
      const links = this.extractLinks($, url);

      // If we haven't reached max depth, crawl the links
      if (depth < this.options.maxDepth) {
        for (const link of links) {
          // Add delay between requests to be polite
          if (this.options.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.delay));
          }
          await this.crawlPage(link, depth + 1);
        }
      }
    } catch (error) {
      console.error(`Error crawling ${url} at depth ${depth}: ${error}`);
      // Continue with other URLs even if this one fails
    }
  }

  /**
   * Extract all valid links from a page
   */
  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    try {
      const links: string[] = [];

      $('a[href]').each((_index: number, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        try {
          // Resolve relative URLs
          const url = new URL(href, baseUrl);
          const normalized = this.normalizeUrl(url.href, baseUrl);
          if (normalized) {
            links.push(normalized);
          }
        } catch {
          // Skip invalid URLs
        }
      });

      return links;
    } catch (error) {
      console.error(`Error extracting links from ${baseUrl}: ${error}`);
      return [];
    }
  }

  /**
   * Normalize a URL (resolve relative URLs, remove fragments, etc.)
   */
  private normalizeUrl(url: string, baseUrl: string): string | null {
    try {
      const urlObj = new URL(url, baseUrl);
      
      // Remove fragment
      urlObj.hash = '';
      
      // Normalize the URL string
      let normalized = urlObj.href;
      
      // Remove trailing slash for consistency (optional)
      if (normalized.endsWith('/') && normalized !== urlObj.origin + '/') {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    } catch (error) {
      console.error(`Error normalizing URL ${url}: ${error}`);
      return null;
    }
  }

  /**
   * Determine if a URL should be crawled
   */
  private shouldCrawl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Only crawl HTTP/HTTPS URLs
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Filter out common non-HTML file extensions
      const pathname = urlObj.pathname.toLowerCase();
      const excludedExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.tar', '.gz',
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp',
        '.mp4', '.mp3', '.avi', '.mov', '.wmv',
        '.css', '.js', '.json', '.xml', '.rss',
      ];
      
      if (excludedExtensions.some(ext => pathname.endsWith(ext))) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error checking if should crawl ${url}: ${error}`);
      return false;
    }
  }

  /**
   * Get statistics about the crawl
   */
  getStats(): { visitedUrls: number; urls: string[] } {
    return {
      visitedUrls: this.visitedUrls.size,
      urls: Array.from(this.visitedUrls),
    };
  }
}
