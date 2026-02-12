const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio'); // For extracting extra content if needed

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
});

const FEEDS = [
    { name: 'CNBC market', url: 'https://www.cnbcindonesia.com/market/rss' },
    { name: 'Kontan Investasi', url: 'https://investasi.kontan.co.id/rss' },
    { name: 'Liputan6 Saham', url: 'https://www.liputan6.com/saham/rss' }
];

class NewsCrawlerService {
    async fetchNews() {
        let allNews = [];

        for (const feed of FEEDS) {
            try {
                console.log(`Fetching RSS: ${feed.name}`);
                const feedResult = await parser.parseURL(feed.url);

                // Process first 5 items from each feed to avoid spamming
                const items = feedResult.items.slice(0, 5).map(item => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    source: feed.name,
                    summary: item.contentSnippet || item.content || ""
                }));

                allNews = allNews.concat(items);
            } catch (error) {
                console.error(`Error fetching ${feed.name}:`, error.message);
            }
        }

        // Sort by date (newest first)
        return allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    }
}

module.exports = new NewsCrawlerService();
