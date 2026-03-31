/**
 * Frontend tests for the sentiment dashboard.
 * Tests the extracted app.js module in a jsdom environment.
 */

// Sample data matching the backend structure
const MOCK_DATA = {
  quotes: {
    AAPL: {
      symbol: "AAPL", yahooSymbol: "AAPL", price: 150.25, change: 1.75,
      changePercent: 1.18, prevClose: 148.50, dayHigh: 152.00, dayLow: 147.80,
      volume: 52000000, fiftyDayAvg: 145.30, twoHundredDayAvg: 140.10, marketCap: 2500000000000,
    },
    BTC: {
      symbol: "BTC", yahooSymbol: "BTC-USD", price: 65000.00, change: -500,
      changePercent: -0.76, prevClose: 65500, dayHigh: 66000, dayLow: 64500,
      volume: 30000000000, fiftyDayAvg: 60000, twoHundredDayAvg: 45000, marketCap: null,
    },
    MSFT: {
      symbol: "MSFT", yahooSymbol: "MSFT", price: 420.50, change: 5.30,
      changePercent: 1.28, prevClose: 415.20, dayHigh: 422.00, dayLow: 418.00,
      volume: 22000000, fiftyDayAvg: 410.00, twoHundredDayAvg: 380.00, marketCap: 3100000000000,
    },
  },
  news: {
    AAPL: {
      symbol: "AAPL",
      articles: [
        {
          title: "Apple stock surges on strong earnings - Bloomberg",
          link: "https://example.com/1",
          pubDate: new Date(Date.now() - 30 * 60000).toISOString(),
          source: "Bloomberg",
          sentiment: { score: 3, comparative: 0.5, label: "Bullish" },
        },
        {
          title: "iPhone sales beat expectations - CNBC",
          link: "https://example.com/2",
          pubDate: new Date(Date.now() - 2 * 3600000).toISOString(),
          source: "CNBC",
          sentiment: { score: 2, comparative: 0.33, label: "Bullish" },
        },
        {
          title: "Apple faces regulatory pressure in EU - Reuters",
          link: "https://example.com/3",
          pubDate: new Date(Date.now() - 5 * 3600000).toISOString(),
          source: "Reuters",
          sentiment: { score: -2, comparative: -0.29, label: "Bearish" },
        },
      ],
      aggregate: { avgScore: 1.0, label: "Neutral", articleCount: 3 },
    },
    BTC: {
      symbol: "BTC",
      articles: [
        {
          title: "Bitcoin price drops below support - CoinDesk",
          link: "https://example.com/4",
          pubDate: new Date(Date.now() - 45 * 60000).toISOString(),
          source: "CoinDesk",
          sentiment: { score: -3, comparative: -0.5, label: "Bearish" },
        },
      ],
      aggregate: { avgScore: -3, label: "Bearish", articleCount: 1 },
    },
    MSFT: {
      symbol: "MSFT",
      articles: [
        {
          title: "Microsoft Azure revenue grows 30% - The Verge",
          link: "https://example.com/5",
          pubDate: new Date(Date.now() - 26 * 3600000).toISOString(),
          source: "The Verge",
          sentiment: { score: 2, comparative: 0.29, label: "Bullish" },
        },
      ],
      aggregate: { avgScore: 2, label: "Bullish", articleCount: 1 },
    },
  },
  lastUpdate: new Date().toISOString(),
};

// Set up jsdom with the HTML structure
function setupDOM() {
  document.body.innerHTML = `
    <div class="header">
      <h1>⚡ OpenEXA Sentiment Dashboard</h1>
      <div class="header-right">
        <span class="last-update" id="lastUpdate">Loading...</span>
        <button class="refresh-btn" id="refreshBtn">↻ Refresh</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="heatmap">Sentiment Heatmap</button>
      <button class="tab" data-tab="news">All News</button>
    </div>
    <div class="summary-strip" id="summaryStrip"></div>
    <div class="main" id="mainContent">
      <div class="loading"><div class="spinner"></div> Loading data...</div>
    </div>
  `;
}

let App;

beforeAll(() => {
  App = require("../public/app");
});

// ── Test Suite ──

describe("Frontend - Helper Functions", () => {
  describe("sentColor", () => {
    test("returns green for Bullish", () => {
      expect(App.sentColor("Bullish")).toBe("var(--green)");
    });

    test("returns red for Bearish", () => {
      expect(App.sentColor("Bearish")).toBe("var(--red)");
    });

    test("returns yellow for Neutral", () => {
      expect(App.sentColor("Neutral")).toBe("var(--yellow)");
    });

    test("returns yellow for unknown labels", () => {
      expect(App.sentColor("N/A")).toBe("var(--yellow)");
    });
  });

  describe("timeAgo", () => {
    test("returns minutes for recent times", () => {
      const date = new Date(Date.now() - 15 * 60000).toISOString();
      expect(App.timeAgo(date)).toBe("15m ago");
    });

    test("returns hours for times within 24h", () => {
      const date = new Date(Date.now() - 5 * 3600000).toISOString();
      expect(App.timeAgo(date)).toBe("5h ago");
    });

    test("returns days for older times", () => {
      const date = new Date(Date.now() - 3 * 24 * 3600000).toISOString();
      expect(App.timeAgo(date)).toBe("3d ago");
    });

    test("returns empty string for null", () => {
      expect(App.timeAgo(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(App.timeAgo(undefined)).toBe("");
    });

    test("returns 0m ago for just now", () => {
      const date = new Date().toISOString();
      expect(App.timeAgo(date)).toBe("0m ago");
    });
  });

  describe("formatNum", () => {
    test("formats trillions", () => {
      expect(App.formatNum(2500000000000)).toBe("2.5T");
    });

    test("formats billions", () => {
      expect(App.formatNum(1500000000)).toBe("1.5B");
    });

    test("formats millions", () => {
      expect(App.formatNum(52000000)).toBe("52.0M");
    });

    test("formats thousands", () => {
      expect(App.formatNum(5000)).toBe("5.0K");
    });

    test("formats small numbers as-is", () => {
      expect(App.formatNum(500)).toBe("500");
    });

    test("returns N/A for null", () => {
      expect(App.formatNum(null)).toBe("N/A");
    });

    test("returns N/A for undefined", () => {
      expect(App.formatNum(undefined)).toBe("N/A");
    });

    test("formats zero", () => {
      expect(App.formatNum(0)).toBe("0");
    });

    test("formats exactly 1000", () => {
      expect(App.formatNum(1000)).toBe("1.0K");
    });

    test("formats exactly 1000000", () => {
      expect(App.formatNum(1000000)).toBe("1.0M");
    });

    test("formats exactly 1000000000", () => {
      expect(App.formatNum(1000000000)).toBe("1.0B");
    });

    test("formats exactly 1000000000000", () => {
      expect(App.formatNum(1000000000000)).toBe("1.0T");
    });
  });

  describe("heatBg", () => {
    test("returns strong green for score > 2", () => {
      expect(App.heatBg(3)).toBe("rgba(16,185,129,0.3)");
    });

    test("returns light green for score > 0.5", () => {
      expect(App.heatBg(1)).toBe("rgba(16,185,129,0.15)");
    });

    test("returns strong red for score < -2", () => {
      expect(App.heatBg(-3)).toBe("rgba(239,68,68,0.3)");
    });

    test("returns light red for score < -0.5", () => {
      expect(App.heatBg(-1)).toBe("rgba(239,68,68,0.15)");
    });

    test("returns yellow for neutral score", () => {
      expect(App.heatBg(0)).toBe("rgba(245,158,11,0.1)");
    });

    test("returns yellow for score = 0.5", () => {
      expect(App.heatBg(0.5)).toBe("rgba(245,158,11,0.1)");
    });

    test("returns yellow for score = -0.5", () => {
      expect(App.heatBg(-0.5)).toBe("rgba(245,158,11,0.1)");
    });
  });
});

describe("Frontend - Data Loading", () => {
  beforeEach(() => {
    setupDOM();
    App.setDATA(null);
    App.setCurrentTab("overview");
    App.setSelectedTicker(null);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("loadData populates DATA and renders", async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve(MOCK_DATA),
    });

    await App.loadData();

    expect(App.getDATA()).toEqual(MOCK_DATA);
    expect(document.getElementById("lastUpdate").textContent).toContain("Updated:");
    expect(document.getElementById("summaryStrip").innerHTML).toContain("AAPL");
  });

  test("loadData handles stringified JSON (Azure wrapper)", async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve(JSON.stringify(MOCK_DATA)),
    });

    await App.loadData();
    expect(App.getDATA()).toEqual(MOCK_DATA);
  });

  test("loadData handles fetch error", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    await App.loadData();

    expect(document.getElementById("mainContent").innerHTML).toContain("Error loading data");
    expect(document.getElementById("mainContent").innerHTML).toContain("Network error");
  });

  test("loadData sets empty lastUpdate when missing", async () => {
    const dataWithoutUpdate = { ...MOCK_DATA, lastUpdate: null };
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve(dataWithoutUpdate),
    });

    await App.loadData();
    expect(document.getElementById("lastUpdate").textContent).toBe("");
  });
});

describe("Frontend - Rendering", () => {
  beforeEach(() => {
    setupDOM();
    App.setDATA(MOCK_DATA);
    App.setCurrentTab("overview");
    App.setSelectedTicker(null);
  });

  describe("renderSummary", () => {
    test("renders summary cards for each ticker", () => {
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.querySelectorAll(".summary-card")).toHaveLength(3);
    });

    test("renders ticker symbols", () => {
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("AAPL");
      expect(strip.innerHTML).toContain("BTC");
      expect(strip.innerHTML).toContain("MSFT");
    });

    test("renders prices", () => {
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("$150.25");
    });

    test("renders sentiment labels", () => {
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("Neutral");
      expect(strip.innerHTML).toContain("Bearish");
      expect(strip.innerHTML).toContain("Bullish");
    });

    test("highlights selected ticker", () => {
      App.setSelectedTicker("AAPL");
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      const selected = strip.querySelectorAll(".summary-card.selected");
      expect(selected).toHaveLength(1);
      expect(selected[0].innerHTML).toContain("AAPL");
    });
  });

  describe("renderOverview", () => {
    test("renders ticker cards in overview grid", () => {
      const html = App.renderOverview();
      const div = document.createElement("div");
      div.innerHTML = html;
      expect(div.querySelectorAll(".ticker-card")).toHaveLength(3);
    });

    test("renders price and change info", () => {
      const html = App.renderOverview();
      expect(html).toContain("$150.25");
      expect(html).toContain("1.18%");
    });

    test("renders sentiment meter", () => {
      const html = App.renderOverview();
      expect(html).toContain("Sentiment Score");
      expect(html).toContain("meter-bar");
    });

    test("renders news section in cards", () => {
      const html = App.renderOverview();
      expect(html).toContain("Latest News");
      expect(html).toContain("Apple stock surges");
    });
  });

  describe("renderHeatmap", () => {
    test("renders heat cells for each ticker", () => {
      const html = App.renderHeatmap();
      const div = document.createElement("div");
      div.innerHTML = html;
      expect(div.querySelectorAll(".heat-cell")).toHaveLength(3);
    });

    test("renders scores and labels", () => {
      const html = App.renderHeatmap();
      expect(html).toContain("Bearish");
      expect(html).toContain("Bullish");
      expect(html).toContain("articles");
    });

    test("applies correct background colors", () => {
      const html = App.renderHeatmap();
      expect(html).toContain("rgba(239,68,68,0.3)");
      expect(html).toContain("rgba(16,185,129,0.15)");
    });
  });

  describe("renderAllNews", () => {
    test("renders all articles from all tickers", () => {
      const html = App.renderAllNews();
      const div = document.createElement("div");
      div.innerHTML = html;
      const rows = div.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(5);
    });

    test("shows article count in header", () => {
      const html = App.renderAllNews();
      expect(html).toContain("All News (5 articles)");
    });

    test("sorts articles by date (newest first)", () => {
      const html = App.renderAllNews();
      const div = document.createElement("div");
      div.innerHTML = html;
      const tds = div.querySelectorAll("tbody td:first-child strong");
      expect(tds[0].textContent).toBe("AAPL");
    });

    test("renders sentiment colors for each article", () => {
      const html = App.renderAllNews();
      expect(html).toContain("var(--green)");
      expect(html).toContain("var(--red)");
    });
  });

  describe("renderDetail", () => {
    test("renders detail panel for AAPL", () => {
      const html = App.renderDetail("AAPL");
      expect(html).toContain("detail-panel");
      expect(html).toContain("AAPL");
    });

    test("renders price and change", () => {
      const html = App.renderDetail("AAPL");
      expect(html).toContain("$150.25");
      expect(html).toContain("1.18%");
    });

    test("renders stat boxes", () => {
      const html = App.renderDetail("AAPL");
      expect(html).toContain("Day High");
      expect(html).toContain("Day Low");
      expect(html).toContain("Prev Close");
      expect(html).toContain("Volume");
      expect(html).toContain("Market Cap");
      expect(html).toContain("50D Avg");
      expect(html).toContain("200D Avg");
      expect(html).toContain("Articles");
    });

    test("renders stat values", () => {
      const html = App.renderDetail("AAPL");
      expect(html).toContain("$152.00");
      expect(html).toContain("$147.80");
      expect(html).toContain("52.0M");
      expect(html).toContain("2.5T");
    });

    test("renders news table", () => {
      const html = App.renderDetail("AAPL");
      expect(html).toContain("NEWS & SENTIMENT");
      expect(html).toContain("Apple stock surges");
    });

    test("renders detail for ticker with no quote data", () => {
      const html = App.renderDetail("UNKNOWN");
      expect(html).toContain("UNKNOWN");
      expect(html).toContain("N/A");
    });
  });

  describe("renderTickerCard", () => {
    test("renders card with ticker name", () => {
      const html = App.renderTickerCard("AAPL");
      expect(html).toContain("ticker-name");
      expect(html).toContain("AAPL");
    });

    test("renders price", () => {
      const html = App.renderTickerCard("AAPL");
      expect(html).toContain("$150.25");
    });

    test("renders positive change class", () => {
      const html = App.renderTickerCard("AAPL");
      expect(html).toContain("positive");
    });

    test("renders negative change class", () => {
      const html = App.renderTickerCard("BTC");
      expect(html).toContain("negative");
    });

    test("renders sentiment meter", () => {
      const html = App.renderTickerCard("AAPL");
      expect(html).toContain("meter-bar");
      expect(html).toContain("Sentiment Score");
    });

    test("renders news items", () => {
      const html = App.renderTickerCard("AAPL");
      expect(html).toContain("Latest News");
      const matches = html.match(/news-item/g);
      expect(matches).toHaveLength(3);
    });

    test("renders card with null price", () => {
      App.setDATA({
        ...MOCK_DATA,
        quotes: { ...MOCK_DATA.quotes, TEST: { symbol: "TEST", price: null, change: null, changePercent: null } },
        news: { ...MOCK_DATA.news, TEST: { symbol: "TEST", articles: [], aggregate: null } },
      });
      const html = App.renderTickerCard("TEST");
      expect(html).toContain("N/A");
    });

    test("renders card with no news", () => {
      App.setDATA({
        ...MOCK_DATA,
        quotes: { ...MOCK_DATA.quotes, TEST: { symbol: "TEST", price: 100, change: 0, changePercent: 0 } },
        news: { ...MOCK_DATA.news, TEST: null },
      });
      const html = App.renderTickerCard("TEST");
      expect(html).not.toContain("Latest News");
    });
  });

  describe("Edge cases - missing data", () => {
    test("renderSummary with null price/change", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: null, change: null, changePercent: null } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: null } },
      });
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("N/A");
    });

    test("renderSummary with missing news data", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100, change: 1, changePercent: 1 } },
        news: { TEST: null },
      });
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("N/A");
    });

    test("renderDetail with null fields", () => {
      App.setDATA({
        ...MOCK_DATA,
        quotes: { ...MOCK_DATA.quotes, NULL: { symbol: "NULL", price: null, change: null, changePercent: null, dayHigh: null, dayLow: null, prevClose: null, volume: null, marketCap: null, fiftyDayAvg: null, twoHundredDayAvg: null } },
        news: { ...MOCK_DATA.news, NULL: { symbol: "NULL", articles: [], aggregate: null } },
      });
      const html = App.renderDetail("NULL");
      expect(html).toContain("N/A");
    });

    test("renderHeatmap with zero scores", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100 } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: { avgScore: 0, label: "Neutral", articleCount: 0 } } },
      });
      const html = App.renderHeatmap();
      expect(html).toContain("rgba(245,158,11,0.1)");
    });

    test("renderHeatmap with null aggregate", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100 } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: null } },
      });
      const html = App.renderHeatmap();
      expect(html).toContain("N/A");
      expect(html).toContain("0 articles");
    });

    test("renderAllNews with empty articles", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100 } },
        news: { TEST: { symbol: "TEST", articles: null } },
      });
      const html = App.renderAllNews();
      expect(html).toContain("0 articles");
    });

    test("renderOverview with ticker with bearish sentiment (score < -1)", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100, change: -5, changePercent: -5 } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: { avgScore: -3, label: "Bearish", articleCount: 0 } } },
      });
      const html = App.renderOverview();
      expect(html).toContain("var(--red)");
    });

    test("renderOverview with ticker with bullish sentiment (score > 1)", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100, change: 5, changePercent: 5 } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: { avgScore: 3, label: "Bullish", articleCount: 0 } } },
      });
      const html = App.renderOverview();
      expect(html).toContain("var(--green)");
    });

    test("renderSummary with negative change shows negative class", () => {
      App.setDATA({
        quotes: { TEST: { symbol: "TEST", price: 100, change: -2, changePercent: -2 } },
        news: { TEST: { symbol: "TEST", articles: [], aggregate: { avgScore: 0, label: "Neutral", articleCount: 0 } } },
      });
      App.renderSummary();
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("negative");
    });
  });
});

describe("Frontend - Interaction", () => {
  beforeEach(() => {
    setupDOM();
    App.setDATA(MOCK_DATA);
    App.setCurrentTab("overview");
    App.setSelectedTicker(null);
  });

  describe("selectTicker", () => {
    test("selects a ticker", () => {
      App.selectTicker("AAPL");
      expect(App.getSelectedTicker()).toBe("AAPL");
    });

    test("deselects when same ticker clicked again", () => {
      App.selectTicker("AAPL");
      expect(App.getSelectedTicker()).toBe("AAPL");
      App.selectTicker("AAPL");
      expect(App.getSelectedTicker()).toBeNull();
    });

    test("renders detail view when ticker selected", () => {
      App.selectTicker("AAPL");
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("detail-panel");
      expect(main.innerHTML).toContain("AAPL");
    });

    test("renders overview when ticker deselected", () => {
      App.selectTicker("AAPL");
      App.selectTicker("AAPL");
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("overview-grid");
    });

    test("updates summary strip selection", () => {
      App.selectTicker("AAPL");
      const strip = document.getElementById("summaryStrip");
      expect(strip.innerHTML).toContain("selected");
    });
  });

  describe("Tab switching", () => {
    test("switches to heatmap tab", () => {
      App.setCurrentTab("heatmap");
      App.renderTab();
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("heatmap-grid");
    });

    test("switches to news tab", () => {
      App.setCurrentTab("news");
      App.renderTab();
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("All News");
    });

    test("switches to overview tab", () => {
      App.setCurrentTab("overview");
      App.renderTab();
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("overview-grid");
    });

    test("renderTab does nothing when DATA is null", () => {
      App.setDATA(null);
      const main = document.getElementById("mainContent");
      const before = main.innerHTML;
      App.renderTab();
      expect(main.innerHTML).toBe(before);
    });

    test("setTab changes tab and renders", () => {
      App.setTab("heatmap");
      expect(App.getCurrentTab()).toBe("heatmap");
      const main = document.getElementById("mainContent");
      expect(main.innerHTML).toContain("heatmap-grid");
    });

    test("setTab clears selected ticker", () => {
      App.setSelectedTicker("AAPL");
      App.setTab("news");
      expect(App.getSelectedTicker()).toBeNull();
    });
  });

  describe("doRefresh", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete global.fetch;
    });

    test("calls API with refresh=true", async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(MOCK_DATA),
      });

      await App.doRefresh();

      expect(global.fetch).toHaveBeenCalledWith("/api/data?refresh=true");
    });

    test("disables and re-enables button", async () => {
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(MOCK_DATA),
      });

      await App.doRefresh();

      const btn = document.getElementById("refreshBtn");
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe("↻ Refresh");
    });

    test("re-enables button even on error", async () => {
      global.fetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({}) })
        .mockRejectedValueOnce(new Error("Network error"));

      await App.doRefresh();

      const btn = document.getElementById("refreshBtn");
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe("↻ Refresh");
    });
  });
});
