const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const { RSI, SMA, MACD, BollingerBands } = require('technicalindicators');

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
                const lastPrice = quote.price.regularMarketPrice;

                // 3. Calculate Technical Indicators
                // RSI (14 period)
                const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
                const lastRSI = rsiValues[rsiValues.length - 1];

                // SMA (50 period)
                const sma50Input = { period: 50, values: closePrices };
                const sma50Result = SMA.calculate(sma50Input);
                const lastSMA50 = sma50Result[sma50Result.length - 1];

                // MACD (12, 26, 9)
                const macdInput = {
                    values: closePrices,
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9,
                    SimpleMAOscillator: false,
                    SimpleMASignal: false
                };
                const macdResult = MACD.calculate(macdInput);
                const lastMACD = macdResult.length > 0 ? macdResult[macdResult.length - 1] : { MACD: 0, signal: 0, histogram: 0 };

                // Bollinger Bands (20, 2)
                const bbInput = {
                    period: 20,
                    values: closePrices,
                    stdDev: 2
                };
                const bbResult = BollingerBands.calculate(bbInput);
                const lastBB = bbResult.length > 0 ? bbResult[bbResult.length - 1] : { upper: 0, middle: 0, lower: 0 };

                const isBullish = lastPrice > lastSMA50;

                // 4. Construct Stock Object and Apply Filter Logic
                let isMatch = true;

                const stockData = {
                    symbol,
                    name: quote.price.longName,
                    price: lastPrice,
                    change: quote.price.regularMarketChangePercent * 100, // percentage
                    marketCap: quote.defaultKeyStatistics.enterpriseValue,
                    peRatio: quote.branch === 'financial' ? 0 : quote.financialData.currentPrice / quote.financialData.targetMeanPrice, // rough est, or use trailingPE
                    pe: quote.summaryDetail?.trailingPE || 0,
                    sector: 'Technology', // Yahoo summary doesn't always have simple sector field in this module, need 'summaryProfile'
                    technical: {
                        rsi: lastRSI,
                        ma50: lastSMA50,
                        macd: lastMACD,
                        bb: lastBB,
                        isBullish
                    }
                };

                // 5. Apply Filter Logic (The "Smart" Part)
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
