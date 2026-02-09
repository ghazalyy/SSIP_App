const OpenAI = require('openai');
// db imported later or passed


// Initialize OpenAI (requires .env OPENAI_API_KEY)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

class SentimentService {
    async analyzeNews(title, summary) {
        if (!process.env.OPENAI_API_KEY) {
            console.warn("No OpenAI Key found, returning mock sentiment.");
            return (Math.random() * 2 - 1); // Mock -1 to 1
        }

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a financial sentiment analyzer. specific output format: only a single number between -1.0 (very negative) and 1.0 (very positive). No text."
                    },
                    {
                        role: "user",
                        content: `Analyze this news: "${title} - ${summary}"`
                    }
                ],
                temperature: 0.1,
            });

            const content = response.choices[0].message.content.trim();
            const score = parseFloat(content);
            return isNaN(score) ? 0 : score;

        } catch (error) {
            console.error("OpenAI Error:", error.message);
            return 0;
        }
    }

    async saveAndBroadcast(newsItem) {
        // Save to DB
        try {
            const stmt = db.prepare('INSERT INTO NewsItem (title, source, url, summary, sentimentScore, relatedTicker) VALUES (?, ?, ?, ?, ?, ?)');
            const update = stmt.run(newsItem.title, newsItem.source, "", newsItem.summary, newsItem.sentimentScore, newsItem.relatedTicker);
            return { ...newsItem, id: update.lastInsertRowid };
        } catch (e) {
            console.error("DB Save Error:", e.message);
            return newsItem; // Return original if save fails
        }
    }
}

module.exports = new SentimentService();
