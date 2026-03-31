const Sentiment = require("sentiment");
const RSSParser = require("rss-parser");

const sentiment = new Sentiment();
const rssParser = new RSSParser();

const DEFAULT_TICKERS = [
  "IAU","IVV","BTC-USD","IBIT","GBTC","FBTC","ARKB","BITB","HODL","BRRR",
  "AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","SPY","QQQ","GLD"
];

// Keep backward-compat alias
const TICKERS = DEFAULT_TICKERS;

const DISPLAY_NAMES = { "BTC-USD": "BTC" };

// Reverse mapping: display name -> Yahoo symbol (e.g. BTC -> BTC-USD)
const REVERSE_DISPLAY = {};
Object.keys(DISPLAY_NAMES).forEach(function(k) {
  REVERSE_DISPLAY[DISPLAY_NAMES[k]] = k;
});

const MAX_TICKERS = 50;

/**
 * Normalize a ticker symbol: uppercase, trim, convert display names to Yahoo symbols.
 * e.g. "btc" -> "BTC-USD", "aapl" -> "AAPL"
 */
function normalizeTicker(t) {
  if (typeof t !== "string") return "";
  var s = t.trim().toUpperCase();
  // If user typed a display name that maps to a Yahoo symbol, convert it
  if (REVERSE_DISPLAY[s]) return REVERSE_DISPLAY[s];
  return s;
}

/**
 * Read tickers from process.env.TICKERS (comma-separated), falling back to DEFAULT_TICKERS.
 */
function getTickersFromEnv() {
  var envVal = process.env.TICKERS;
  if (!envVal || !envVal.trim()) return DEFAULT_TICKERS.slice();
  var raw = envVal.split(",");
  var seen = {};
  var result = [];
  for (var i = 0; i < raw.length; i++) {
    var t = normalizeTicker(raw[i]);
    if (!t || seen[t]) continue;
    seen[t] = true;
    result.push(t);
  }
  return result.length > 0 ? result.slice(0, MAX_TICKERS) : DEFAULT_TICKERS.slice();
}

/**
 * Validate and deduplicate a list of tickers. Skips empty strings/duplicates, limits to MAX_TICKERS.
 */
function validateTickers(tickers) {
  var seen = {};
  var result = [];
  for (var i = 0; i < tickers.length; i++) {
    var t = normalizeTicker(tickers[i]);
    if (!t || seen[t]) continue;
    seen[t] = true;
    result.push(t);
    if (result.length >= MAX_TICKERS) break;
  }
  return result;
}

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

/**
 * Fetch all data. Accepts an optional tickers array; falls back to getTickersFromEnv().
 */
async function fetchAllData(tickers) {
  var tickerList = tickers ? validateTickers(tickers) : getTickersFromEnv();
  if (tickerList.length === 0) tickerList = DEFAULT_TICKERS.slice();

  const quotes = [];
  for (const ticker of tickerList) {
    quotes.push(await fetchQuote(ticker));
    await new Promise(r => setTimeout(r, 150));
  }

  const news = await Promise.all(tickerList.map(fetchNews));

  const quotesMap = {};
  quotes.forEach((q) => { quotesMap[q.symbol] = q; });

  const newsMap = {};
  news.forEach((n) => { newsMap[n.symbol] = n; });

  return { quotes: quotesMap, news: newsMap, lastUpdate: new Date().toISOString() };
}

module.exports = {
  fetchAllData, fetchQuote, fetchNews, extractSource,
  TICKERS, DEFAULT_TICKERS, DISPLAY_NAMES,
  getTickersFromEnv, validateTickers, normalizeTicker,
  MAX_TICKERS,
};
