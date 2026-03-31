const Sentiment = require("sentiment");
const RSSParser = require("rss-parser");

const sentiment = new Sentiment();
const rssParser = new RSSParser();

const TICKERS = [
  "IAU","IVV","BTC-USD","IBIT","GBTC","FBTC","ARKB","BITB","HODL","BRRR",
  "AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","SPY","QQQ","GLD"
];

const DISPLAY_NAMES = { "BTC-USD": "BTC" };

async function fetchQuote(ticker) {
  const display = DISPLAY_NAMES[ticker] || ticker;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    return {
      symbol: display, yahooSymbol: ticker, price, change,
      changePercent: changePct, prevClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      fiftyDayAvg: meta.fiftyDayAverage,
      twoHundredDayAvg: meta.twoHundredDayAverage,
      marketCap: null,
    };
  } catch (e) {
    return { symbol: display, yahooSymbol: ticker, error: e.message };
  }
}

async function fetchNews(ticker) {
  const displayName = DISPLAY_NAMES[ticker] || ticker;
  const query = encodeURIComponent(`${displayName} stock`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const feed = await rssParser.parseURL(url);
    const articles = (feed.items || []).slice(0, 8).map((item) => {
      const analysis = sentiment.analyze(item.title || "");
      return {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: extractSource(item.title),
        sentiment: {
          score: analysis.score,
          comparative: analysis.comparative,
          label: analysis.score > 1 ? "Bullish" : analysis.score < -1 ? "Bearish" : "Neutral",
        },
      };
    });

    const scores = articles.map((a) => a.sentiment.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      symbol: displayName, articles,
      aggregate: {
        avgScore: Math.round(avg * 100) / 100,
        label: avg > 1 ? "Bullish" : avg < -1 ? "Bearish" : "Neutral",
        articleCount: articles.length,
      },
    };
  } catch (e) {
    return { symbol: displayName, articles: [], aggregate: { avgScore: 0, label: "N/A", articleCount: 0 }, error: e.message };
  }
}

function extractSource(title) {
  if (!title) return "Unknown";
  const match = title.match(/- ([^-]+)$/);
  return match ? match[1].trim() : "Unknown";
}

async function fetchAllData() {
  const quotes = [];
  for (const ticker of TICKERS) {
    quotes.push(await fetchQuote(ticker));
    await new Promise(r => setTimeout(r, 150));
  }

  const news = await Promise.all(TICKERS.map(fetchNews));

  const quotesMap = {};
  quotes.forEach((q) => { quotesMap[q.symbol] = q; });

  const newsMap = {};
  news.forEach((n) => { newsMap[n.symbol] = n; });

  return { quotes: quotesMap, news: newsMap, lastUpdate: new Date().toISOString() };
}

module.exports = { fetchAllData, TICKERS };
