class AlertService {
    constructor() {
        this.alerts = [];
    }

    check(stockData, newsItem = null) {
        const newAlerts = [];
        const { symbol, technical, price, change } = stockData;

        // 1. Technical Alerts
        if (technical) {
            if (technical.rsi < 30) {
                newAlerts.push({
                    type: 'TECHNICAL',
                    level: 'opportunity',
                    symbol,
                    message: `RSI Oversold (${technical.rsi.toFixed(2)}). Potential buy signal.`
                });
            }
            if (technical.rsi > 70) {
                newAlerts.push({
                    type: 'TECHNICAL',
                    level: 'warning',
                    symbol,
                    message: `RSI Overbought (${technical.rsi.toFixed(2)}). Potential pullback.`
                });
            }
            if (technical.isBullish) {
                newAlerts.push({
                    type: 'TECHNICAL',
                    level: 'info',
                    symbol,
                    message: `Bullish Trend detected (Price > MA50).`
                });
            }

            // MACD Alerts
            if (technical.macd) {
                if (technical.macd.histogram > 0 && technical.macd.histogram < 0.5) { // Just crossed up (simplified check)
                    newAlerts.push({
                        type: 'TECHNICAL',
                        level: 'opportunity',
                        symbol,
                        message: `MACD Bullish Crossover Potential.`
                    });
                }
            }

            // Bollinger Bands Alerts
            if (technical.bb && price) {
                if (price < technical.bb.lower) {
                    newAlerts.push({
                        type: 'TECHNICAL',
                        level: 'opportunity',
                        symbol,
                        message: `Price below Lower Bollinger Band (Oversold).`
                    });
                }
                if (price > technical.bb.upper) {
                    newAlerts.push({
                        type: 'TECHNICAL',
                        level: 'warning',
                        symbol,
                        message: `Price above Upper Bollinger Band (Overbought).`
                    });
                }
            }
        }

        // 2. Volatility Alerts
        if (Math.abs(change) > 5) { // > 5% move
            newAlerts.push({
                type: 'VOLATILITY',
                level: 'danger',
                symbol,
                message: `High volatility detected! Price moved ${change.toFixed(2)}%.`
            });
        }

        // 3. Sentiment/Context Alerts (if news is provided)
        if (newsItem && newsItem.sentimentScore) {
            if (newsItem.sentimentScore > 0.5) {
                newAlerts.push({
                    type: 'SENTIMENT',
                    level: 'success',
                    symbol,
                    message: `Positive market sentiment detected from recent news.`
                });
            }
            if (newsItem.sentimentScore < -0.5) {
                newAlerts.push({
                    type: 'SENTIMENT',
                    level: 'warning',
                    symbol,
                    message: `Negative market sentiment detected from recent news.`
                });
            }
        }

        // Store and return
        this.alerts.push(...newAlerts);
        return newAlerts;
    }

    getRecentAlerts(limit = 10) {
        return this.alerts.slice(-limit).reverse();
    }
}

module.exports = new AlertService();
