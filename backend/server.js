const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./lib/db'); // now returns better-sqlite3 instance
const marketService = require('./services/MarketService');
const sentimentService = require('./services/SentimentService');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const STOCKS = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'UNVR', 'ICBP'];

// Seed Stocks
const insertStock = db.prepare('INSERT OR IGNORE INTO Stock (symbol, name, sector) VALUES (?, ?, ?)');
STOCKS.forEach(symbol => insertStock.run(symbol, `${symbol} Indonesia`, 'Finance'));

// Prepared Statements
const insertMarketData = db.prepare('INSERT INTO MarketData (stockSymbol, price, change, volume) VALUES (?, ?, ?, ?)');

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Real-Time Market Stream' }));

    ws.on('close', () => console.log('Client disconnected'));
});

// Broadcast Loop (5s interval to respect rate limits)
setInterval(async () => {
    for (const symbol of STOCKS) {
        // Fetch real data
        const data = await marketService.getRealTimeQuote(symbol);

        if (data) {
            // Broadcast
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'TRADE', data }));
                }
            });

            // Save to DB
            try {
                insertMarketData.run(symbol, data.price, data.change || 0, data.volume || 0);
            } catch (err) {
                console.error("DB Save Error:", err.message);
            }
        }
    }
}, 5000);

// News Simulation Loop (20s interval)
setInterval(async () => {
    const symbol = STOCKS[Math.floor(Math.random() * STOCKS.length)];
    const templates = [
        "Reports indicate strong earnings growth for Q3.",
        "CEO announces new strategic partnership.",
        "Regulatory concerns cause minor sell-off.",
        "Volume spikes as institutional investors enter.",
        "Technical breakout above 50-day moving average."
    ];
    const text = templates[Math.floor(Math.random() * templates.length)];

    const newsItem = {
        title: `${symbol}: ${text}`,
        summary: `${symbol} is drawing attention. ${text}`,
        source: "AI Analyst",
        relatedTicker: symbol,
        sentimentScore: 0
    };

    // Analyze with OpenAI
    const score = await sentimentService.analyzeNews(newsItem.title, newsItem.summary);
    newsItem.sentimentScore = score;

    // Save (if possible)
    try {
        await sentimentService.saveAndBroadcast(newsItem);
    } catch (e) {
        console.error("News Save Error:", e.message);
    }

    // Broadcast
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'NEWS', data: newsItem }));
        }
    });

}, 20000);

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`SSIP Backend Server running on port ${PORT}`);
});
