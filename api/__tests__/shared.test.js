const Sentiment = require("sentiment");

// Mock rss-parser before requiring shared
jest.mock("rss-parser", () => {
  const mockParseURL = jest.fn();
  return jest.fn().mockImplementation(() => ({ parseURL: mockParseURL }));
});

// We need to get the mock instance after requiring shared
let shared;
let rssParserInstance;

beforeAll(() => {
  shared = require("../shared");
  const RSSParser = require("rss-parser");
  rssParserInstance = new RSSParser();
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset global.fetch mock
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

// ── TICKERS & DISPLAY_NAMES ──

describe("TICKERS", () => {
  test("contains all 20 tickers", () => {
    expect(shared.TICKERS).toHaveLength(20);
  });

  test("includes key tickers", () => {
    const expected = [
      "IAU","IVV","BTC-USD","IBIT","GBTC","FBTC","ARKB","BITB","HODL","BRRR",
      "AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","SPY","QQQ","GLD"
    ];
    expect(shared.TICKERS).toEqual(expected);
  });
});

describe("DISPLAY_NAMES", () => {
  test("maps BTC-USD to BTC", () => {
    expect(shared.DISPLAY_NAMES["BTC-USD"]).toBe("BTC");
  });

  test("has only BTC-USD mapping", () => {
    expect(Object.keys(shared.DISPLAY_NAMES)).toEqual(["BTC-USD"]);
  });
});

// ── extractSource ──

describe("extractSource", () => {
  test("extracts source from 'Title - Source Name'", () => {
    expect(shared.extractSource("Bitcoin rises 5% - Bloomberg")).toBe("Bloomberg");
  });

  test("extracts source with multiple dashes (takes last segment)", () => {
    expect(shared.extractSource("BTC - up big today - Reuters")).toBe("Reuters");
  });

  test("returns Unknown when no dash", () => {
    expect(shared.extractSource("Bitcoin rises 5%")).toBe("Unknown");
  });

  test("returns Unknown for null title", () => {
    expect(shared.extractSource(null)).toBe("Unknown");
  });

  test("returns Unknown for undefined title", () => {
    expect(shared.extractSource(undefined)).toBe("Unknown");
  });

  test("returns Unknown for empty string", () => {
    expect(shared.extractSource("")).toBe("Unknown");
  });

  test("trims whitespace from source", () => {
    expect(shared.extractSource("Title -   CNBC  ")).toBe("CNBC");
  });
});

// ── fetchQuote ──

describe("fetchQuote", () => {
  const mockYahooResponse = (overrides = {}) => ({
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 150.25,
          chartPreviousClose: 148.50,
          regularMarketDayHigh: 152.00,
          regularMarketDayLow: 147.80,
          regularMarketVolume: 52000000,
          fiftyDayAverage: 145.30,
          twoHundredDayAverage: 140.10,
          ...overrides,
        }
      }]
    }
  });

  test("returns correct quote data for AAPL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockYahooResponse()),
    });

    const result = await shared.fetchQuote("AAPL");
    expect(result.symbol).toBe("AAPL");
    expect(result.yahooSymbol).toBe("AAPL");
    expect(result.price).toBe(150.25);
    expect(result.prevClose).toBe(148.50);
    expect(result.change).toBeCloseTo(1.75);
    expect(result.changePercent).toBeCloseTo((1.75 / 148.50) * 100);
    expect(result.dayHigh).toBe(152.00);
    expect(result.dayLow).toBe(147.80);
    expect(result.volume).toBe(52000000);
    expect(result.fiftyDayAvg).toBe(145.30);
    expect(result.twoHundredDayAvg).toBe(140.10);
    expect(result.marketCap).toBeNull();
  });

  test("maps BTC-USD display name to BTC", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockYahooResponse({ regularMarketPrice: 65000, chartPreviousClose: 64000 })),
    });

    const result = await shared.fetchQuote("BTC-USD");
    expect(result.symbol).toBe("BTC");
    expect(result.yahooSymbol).toBe("BTC-USD");
  });

  test("uses previousClose when chartPreviousClose is missing", async () => {
    const data = mockYahooResponse();
    delete data.chart.result[0].meta.chartPreviousClose;
    data.chart.result[0].meta.previousClose = 149.00;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await shared.fetchQuote("AAPL");
    expect(result.prevClose).toBe(149.00);
    expect(result.change).toBeCloseTo(1.25);
  });

  test("returns 0 changePercent when prevClose is 0/falsy", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockYahooResponse({ chartPreviousClose: 0 })),
    });

    const result = await shared.fetchQuote("AAPL");
    expect(result.changePercent).toBe(0);
  });

  test("handles HTTP error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await shared.fetchQuote("INVALID");
    expect(result.symbol).toBe("INVALID");
    expect(result.error).toBe("HTTP 404");
  });

  test("handles network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network failure"));

    const result = await shared.fetchQuote("AAPL");
    expect(result.error).toBe("Network failure");
    expect(result.symbol).toBe("AAPL");
  });

  test("handles malformed JSON response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ chart: { result: null } }),
    });

    const result = await shared.fetchQuote("AAPL");
    expect(result.error).toBeDefined();
  });

  test("calls Yahoo Finance API with correct URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockYahooResponse()),
    });

    await shared.fetchQuote("AAPL");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("query1.finance.yahoo.com/v8/finance/chart/AAPL"),
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  test("encodes ticker in URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockYahooResponse()),
    });

    await shared.fetchQuote("BTC-USD");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("BTC-USD"),
      expect.any(Object)
    );
  });
});

// ── fetchNews ──

describe("fetchNews", () => {
  const makeRSSItems = (items) => ({
    items: items.map((title, i) => ({
      title,
      link: `https://news.example.com/article${i}`,
      pubDate: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  });

  test("returns articles with sentiment scores", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Amazing great excellent wonderful stock - Bloomberg",
      "Terrible horrible crash disaster - Reuters",
      "Stock price unchanged today - CNBC",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.symbol).toBe("AAPL");
    expect(result.articles).toHaveLength(3);
    expect(result.articles[0].sentiment).toBeDefined();
    expect(result.articles[0].sentiment.score).toBeDefined();
    expect(result.articles[0].sentiment.label).toBeDefined();
    expect(result.articles[0].source).toBe("Bloomberg");
  });

  test("labels bullish articles (score > 1)", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    // "great excellent amazing wonderful" should yield score > 1
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Great excellent amazing wonderful fantastic superb - Source",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.articles[0].sentiment.label).toBe("Bullish");
    expect(result.articles[0].sentiment.score).toBeGreaterThan(1);
  });

  test("labels bearish articles (score < -1)", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Terrible horrible awful disaster catastrophe crash - Source",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.articles[0].sentiment.label).toBe("Bearish");
    expect(result.articles[0].sentiment.score).toBeLessThan(-1);
  });

  test("labels neutral articles (-1 <= score <= 1)", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Stock price today - CNBC",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.articles[0].sentiment.label).toBe("Neutral");
  });

  test("calculates aggregate correctly", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Great excellent amazing wonderful - Source",
      "Great excellent amazing wonderful - Source",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.aggregate.articleCount).toBe(2);
    expect(typeof result.aggregate.avgScore).toBe("number");
    expect(["Bullish", "Bearish", "Neutral"]).toContain(result.aggregate.label);
  });

  test("aggregate label is Bullish when avg > 1", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Great excellent amazing wonderful fantastic superb - Source",
      "Great excellent amazing wonderful fantastic superb - Source",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.aggregate.label).toBe("Bullish");
    expect(result.aggregate.avgScore).toBeGreaterThan(1);
  });

  test("aggregate label is Bearish when avg < -1", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems([
      "Terrible horrible awful disaster catastrophe crash - Source",
      "Terrible horrible awful disaster catastrophe crash - Source",
    ]));

    const result = await shared.fetchNews("AAPL");
    expect(result.aggregate.label).toBe("Bearish");
    expect(result.aggregate.avgScore).toBeLessThan(-1);
  });

  test("slices to max 8 articles", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    const titles = Array.from({ length: 12 }, (_, i) => `Article ${i} - Source`);
    parser.parseURL.mockResolvedValue(makeRSSItems(titles));

    const result = await shared.fetchNews("AAPL");
    expect(result.articles).toHaveLength(8);
  });

  test("handles empty feed", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue({ items: [] });

    const result = await shared.fetchNews("AAPL");
    expect(result.articles).toHaveLength(0);
    expect(result.aggregate.avgScore).toBe(0);
    expect(result.aggregate.articleCount).toBe(0);
  });

  test("handles missing items property", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue({});

    const result = await shared.fetchNews("AAPL");
    expect(result.articles).toHaveLength(0);
  });

  test("handles RSS fetch error", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockRejectedValue(new Error("RSS fetch failed"));

    const result = await shared.fetchNews("AAPL");
    expect(result.articles).toEqual([]);
    expect(result.aggregate.label).toBe("N/A");
    expect(result.aggregate.articleCount).toBe(0);
    expect(result.error).toBe("RSS fetch failed");
  });

  test("uses BTC display name for BTC-USD", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems(["BTC news - Source"]));

    const result = await shared.fetchNews("BTC-USD");
    expect(result.symbol).toBe("BTC");
  });

  test("articles include link and pubDate", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue({
      items: [{
        title: "Test Article - Source",
        link: "https://example.com/article",
        pubDate: "2024-01-01T00:00:00Z",
      }],
    });

    const result = await shared.fetchNews("AAPL");
    expect(result.articles[0].link).toBe("https://example.com/article");
    expect(result.articles[0].pubDate).toBe("2024-01-01T00:00:00Z");
  });

  test("articles include comparative score", async () => {
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue(makeRSSItems(["Good news today - Source"]));

    const result = await shared.fetchNews("AAPL");
    expect(typeof result.articles[0].sentiment.comparative).toBe("number");
  });
});

// ── fetchAllData ──

describe("fetchAllData", () => {
  beforeEach(() => {
    // Mock fetch for Yahoo Finance
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 100,
              chartPreviousClose: 99,
              regularMarketDayHigh: 101,
              regularMarketDayLow: 98,
              regularMarketVolume: 1000000,
              fiftyDayAverage: 95,
              twoHundredDayAverage: 90,
            }
          }]
        }
      }),
    });

    // Mock RSS parser
    const RSSParser = require("rss-parser");
    const parser = new RSSParser();
    parser.parseURL.mockResolvedValue({
      items: [{
        title: "Test news - Source",
        link: "https://example.com",
        pubDate: new Date().toISOString(),
      }],
    });
  });

  test("returns object with quotes, news, and lastUpdate", async () => {
    const result = await shared.fetchAllData();
    expect(result).toHaveProperty("quotes");
    expect(result).toHaveProperty("news");
    expect(result).toHaveProperty("lastUpdate");
  });

  test("quotes are keyed by display name", async () => {
    const result = await shared.fetchAllData();
    expect(result.quotes).toBeDefined();
    // BTC-USD should be keyed as BTC
    expect(result.quotes["BTC"]).toBeDefined();
    expect(result.quotes["AAPL"]).toBeDefined();
  });

  test("news are keyed by display name", async () => {
    const result = await shared.fetchAllData();
    expect(result.news).toBeDefined();
    expect(result.news["BTC"]).toBeDefined();
    expect(result.news["AAPL"]).toBeDefined();
  });

  test("lastUpdate is a valid ISO string", async () => {
    const result = await shared.fetchAllData();
    expect(new Date(result.lastUpdate).toISOString()).toBe(result.lastUpdate);
  });

  test("fetches quotes for all 20 tickers", async () => {
    const result = await shared.fetchAllData();
    expect(Object.keys(result.quotes)).toHaveLength(20);
  });

  test("fetches news for all 20 tickers", async () => {
    const result = await shared.fetchAllData();
    expect(Object.keys(result.news)).toHaveLength(20);
  });
}, 120000); // increase timeout for sequential fetches with 150ms delays
