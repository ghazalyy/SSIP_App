const yahooFinance = require('yahoo-finance2').default;
const prisma = require('../lib/db');

// Map local tickers to Yahoo Finance Tickers (e.g., BBCA -> BBCA.JK)
const TICKER_MAP = {
    'BBCA': 'BBCA.JK',
    'BBRI': 'BBRI.JK',
    'BMRI': 'BMRI.JK',
    'TLKM': 'TLKM.JK',
    'ASII': 'ASII.JK',
    'GOTO': 'GOTO.JK',
    'UNVR': 'UNVR.JK',
    'ICBP': 'ICBP.JK'
};

class MarketService {
    async getRealTimeQuote(symbol) {
        try {
            const yfSymbol = TICKER_MAP[symbol];
            if (!yfSymbol) return null;

            const quote = await yahooFinance.quote(yfSymbol);
            return {
                symbol: symbol,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChangePercent,
                volume: quote.regularMarketVolume,
                timestamp: new Date()
            };
        } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error.message);
            return null;
        }
    }

    async getHistoricalData(symbol) {
        try {
            const yfSymbol = TICKER_MAP[symbol];
            if (!yfSymbol) return [];

            const today = new Date();
            const queryOptions = { period1: '2023-01-01', interval: '1d' };
            const result = await yahooFinance.historical(yfSymbol, queryOptions);

            return result.map(candle => ({
                time: candle.date.toISOString().split('T')[0],
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
            }));
        } catch (error) {
            console.error(`Error fetching history for ${symbol}:`, error.message);
            return [];
        }
    }
}

module.exports = new MarketService();
