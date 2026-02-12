const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const { RSI, SMA } = require('technicalindicators');

// Map local tickers to Yahoo Finance Tickers
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

class ScreenerService {
    async scan(criteria = {}) {
        const results = [];
        const symbols = Object.keys(TICKER_MAP);

        for (const symbol of symbols) {
            try {
                const yfSymbol = TICKER_MAP[symbol];

                // 1. Fetch Fundamental Data (Quote Summary)
                const quote = await yahooFinance.quoteSummary(yfSymbol, { modules: ['defaultKeyStatistics', 'financialData', 'price'] });

                // 2. Fetch Historical Data (for Technicals like RSI, MA)
                // Use chart() for better compatibility/reliability
                const historyChartResult = await yahooFinance.chart(yfSymbol, { period1: '2024-01-01', interval: '1d' });
                const candles = historyChartResult.quotes;

                console.log(`${symbol} History Length: ${candles ? candles.length : 0}`);

                // Need at least 50 days for MA50
                if (!candles || candles.length < 50) {
                    continue;
                }

                const closePrices = candles.map(candle => candle.close);

                // 3. Calculate Technical Indicators
                // RSI (14 period)
                const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
                const currentRSI = rsiValues[rsiValues.length - 1];

                // MA50
                const sma50Values = SMA.calculate({ values: closePrices, period: 50 });
                const currentSMA50 = sma50Values[sma50Values.length - 1];
                const currentPrice = quote.price.regularMarketPrice;

                // 4. Construct Stock Object
                const stockData = {
                    symbol: symbol,
                    price: currentPrice,
                    peRatio: quote.summaryDetail?.trailingPE || 0,
                    roe: quote.financialData?.returnOnEquity || 0,
                    marketCap: quote.price?.marketCap || 0,
                    technical: {
                        rsi: currentRSI,
                        ma50: currentSMA50,
                        isBullish: currentPrice > currentSMA50 // Simple Technical Rule
                    }
                };

                // 5. Apply Filter Logic (The "Smart" Part)
                let isMatch = true;

                // Example Rule: Price > MA50 (Bullish)
                if (criteria.bullishOnly && !stockData.technical.isBullish) isMatch = false;

                // Example Rule: RSI Oversold (< 30)
                if (criteria.rsiOversold && stockData.technical.rsi > 30) isMatch = false;

                // Example Rule: PE < 15 (Undervalued)
                if (criteria.undervalued && stockData.peRatio > 15) isMatch = false;

                if (isMatch) {
                    results.push(stockData);
                }

            } catch (error) {
                console.error(`Screener Error for ${symbol}:`, error);
            }
        }

        return results;
    }
}

module.exports = new ScreenerService();
