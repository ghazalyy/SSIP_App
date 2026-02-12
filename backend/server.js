const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io'); // Switch to socket.io
const db = require('./lib/db');
const marketService = require('./services/MarketService');
const sentimentService = require('./services/SentimentService');
const screenerService = require('./services/ScreenerService'); // Import Screener

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
// Initialize Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    }
});

app.get('/api/screener', async (req, res) => {
    try {
        const criteria = {
            bullishOnly: req.query.bullish === 'true',
            rsiOversold: req.query.oversold === 'true',
            undervalued: req.query.value === 'true'
        };
        const results = await screenerService.scan(criteria);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const STOCKS = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'UNVR', 'ICBP'];

// Seed Stocks
const insertStock = db.prepare('INSERT OR IGNORE INTO Stock (symbol, name, sector) VALUES (?, ?, ?)');
STOCKS.forEach(symbol => insertStock.run(symbol, `${symbol} Indonesia`, 'Finance'));

// Prepared Statements
const insertMarketData = db.prepare('INSERT INTO MarketData (stockSymbol, price, change, volume) VALUES (?, ?, ?, ?)');

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.emit('WELCOME', { message: 'Connected to SSIP Real-Time Core' });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const alertService = require('./services/AlertService');

// Broadcast Loop (5s interval to respect rate limits)
// In a real app, this should be a separate worker or scheduler
setInterval(async () => {
    // We will broadcast updates for all stocks
    const updates = [];

    for (const symbol of STOCKS) {
        // Fetch real data
        const data = await marketService.getRealTimeQuote(symbol);

        if (data) {
            // Calculate Technicals on the fly for Alerting (simplification)
            // In prod, this would come from a cached analysis or the ScreenerService
            // For now, we mock the technical object on the real-time data or fetch it if needed.
            // Let's quickly re-use screener logic or just mock it for the "Alert" demo if getting history is too heavy every 5s.
            // BETTER: Use the ScreenerService to get the full data package occasionally, OR
            // just let the ScreenerService run its own loop.

            // Let's simulate that we have technicals attached for the alert check
            // We can call screenerService.scan({ symbol }) if we optimized it, but it fetches history every time.
            // Optimization: Just check price volatility for now in the fast loop.

            const alerts = alertService.check(data); // data has price/change

            if (alerts.length > 0) {
                io.emit('ALERT_UPDATE', alerts);
            }

            // Save to DB
            try {
                insertMarketData.run(symbol, data.price, data.change || 0, data.volume || 0);
            } catch (err) {
                console.error("DB Save Error:", err.message);
            }
            updates.push(data);
        }
    }

    if (updates.length > 0) {
        io.emit('MARKET_UPDATE', updates); // Broadcast all updates at once
    }

}, 5000);

const newsCrawlerService = require('./services/NewsCrawlerService');

// News Crawling Loop (Every 5 minutes, 300000ms) - Increased interval for real scraping
setInterval(async () => {
    console.log("Starting News Crawl...");
    const latestNews = await newsCrawlerService.fetchNews();

    // We only process the top 3 newest articles to avoid rate limits on Sentiment API
    const newsToProcess = latestNews.slice(0, 3);

    for (let newsItem of newsToProcess) {
        // Simple duplicate check (in a real app, check DB first)
        // Here we just re-broadcast for demo purposes, or skip if needed.
        // Let's assume we broadcast everything we find for now.

        // Analyze with OpenAI (or mock)
        const score = await sentimentService.analyzeNews(newsItem.title, newsItem.summary);

        // Enrich news item
        const enrichedNews = {
            ...newsItem,
            sentimentScore: score,
            relatedTicker: 'MARKET', // Default global, or extract from text
            timestamp: new Date(newsItem.pubDate)
        };

        // Try to extract ticker from title (Basic regex)
        for (const stock of STOCKS) {
            if (enrichedNews.title.includes(stock) || enrichedNews.summary.includes(stock)) {
                enrichedNews.relatedTicker = stock;
                break;
            }
        }

        // Save (if possible)
        try {
            await sentimentService.saveAndBroadcast(enrichedNews);
        } catch (e) {
            // console.error("News Save Error:", e.message);
        }

        // Broadcast
        io.emit('NEWS_UPDATE', enrichedNews);
    }

}, 300000); // 5 minutes

// Initial run after 5 seconds to populate data quickly on startup
setTimeout(async () => {
    console.log("Initial News Fetch...");
    // trigger the same logic (refactor to function if used often)
    // For brevity, let's just emit a "waiting for news" or assume the interval picks it up.
    // Or better, just call the logic once.
    const latestNews = await newsCrawlerService.fetchNews();
    if (latestNews.length > 0) {
        const newsItem = latestNews[0];
        const score = await sentimentService.analyzeNews(newsItem.title, newsItem.summary);
        io.emit('NEWS_UPDATE', {
            ...newsItem,
            sentimentScore: score,
            relatedTicker: 'MARKET'
        });
    }
}, 5000);

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`SSIP Backend Server running on port ${PORT}`);
});
