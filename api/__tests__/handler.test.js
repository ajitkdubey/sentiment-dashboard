const mockFetchAllData = jest.fn();
const mockGetTickersFromEnv = jest.fn();
const mockValidateTickers = jest.fn();

jest.mock("../shared", () => ({
  fetchAllData: mockFetchAllData,
  getTickersFromEnv: mockGetTickersFromEnv,
  validateTickers: mockValidateTickers,
}));

const DEFAULT_TICKERS = ["AAPL", "MSFT", "BTC-USD"];

const MOCK_RESPONSE = {
  quotes: { AAPL: { symbol: "AAPL", price: 150 } },
  news: { AAPL: { symbol: "AAPL", articles: [] } },
  lastUpdate: "2024-01-01T00:00:00.000Z",
};

describe("handler (data/index.js)", () => {
  let handler;

  beforeEach(() => {
    jest.resetModules();
    mockFetchAllData.mockReset();
    mockGetTickersFromEnv.mockReset();
    mockValidateTickers.mockReset();

    mockFetchAllData.mockResolvedValue(MOCK_RESPONSE);
    mockGetTickersFromEnv.mockReturnValue(DEFAULT_TICKERS.slice());
    mockValidateTickers.mockImplementation(function(arr) { return arr.filter(Boolean); });

    jest.mock("../shared", () => ({
      fetchAllData: mockFetchAllData,
      getTickersFromEnv: mockGetTickersFromEnv,
      validateTickers: mockValidateTickers,
    }));
    handler = require("../data/index");
  });

  function makeContext() {
    return { res: null };
  }

  function makeReq(query = {}) {
    return { query };
  }

  test("returns 200 with fresh data on first call", async () => {
    const context = makeContext();
    await handler(context, makeReq());

    expect(context.res.status).toBe(200);
    expect(context.res.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(context.res.body);
    expect(body.quotes).toBeDefined();
    expect(body.news).toBeDefined();
    expect(body.lastUpdate).toBeDefined();
    expect(mockFetchAllData).toHaveBeenCalledTimes(1);
  });

  test("returns cached data on second call within TTL", async () => {
    const context1 = makeContext();
    await handler(context1, makeReq());

    const context2 = makeContext();
    await handler(context2, makeReq());

    expect(mockFetchAllData).toHaveBeenCalledTimes(1);

    const body1 = JSON.parse(context1.res.body);
    const body2 = JSON.parse(context2.res.body);
    expect(body1).toEqual(body2);
  });

  test("refresh=true bypasses cache", async () => {
    const context1 = makeContext();
    await handler(context1, makeReq());

    const context2 = makeContext();
    await handler(context2, makeReq({ refresh: "true" }));

    expect(mockFetchAllData).toHaveBeenCalledTimes(2);
  });

  test("cache expires after TTL", async () => {
    const realDateNow = Date.now;

    const context1 = makeContext();
    const startTime = realDateNow.call(Date);
    Date.now = jest.fn().mockReturnValue(startTime);
    await handler(context1, makeReq());

    // Advance time past TTL (5 minutes + 1 second)
    Date.now = jest.fn().mockReturnValue(startTime + 5 * 60 * 1000 + 1000);

    const context2 = makeContext();
    await handler(context2, makeReq());

    expect(mockFetchAllData).toHaveBeenCalledTimes(2);

    Date.now = realDateNow;
  });

  test("returns 500 when fetchAllData throws", async () => {
    mockFetchAllData.mockRejectedValue(new Error("API failure"));

    const context = makeContext();
    await handler(context, makeReq());

    expect(context.res.status).toBe(500);
    const body = JSON.parse(context.res.body);
    expect(body.error).toBe("API failure");
  });

  // ── Custom tickers query param ──

  test("passes custom tickers from query param to fetchAllData", async () => {
    const context = makeContext();
    await handler(context, makeReq({ tickers: "COIN,MSTR" }));

    expect(mockValidateTickers).toHaveBeenCalled();
    // fetchAllData should be called with the merged ticker list
    expect(mockFetchAllData).toHaveBeenCalledTimes(1);
    const callArg = mockFetchAllData.mock.calls[0][0];
    expect(callArg).toEqual(expect.arrayContaining(["COIN", "MSTR"]));
  });

  test("merges custom tickers with defaults", async () => {
    const context = makeContext();
    await handler(context, makeReq({ tickers: "COIN" }));

    expect(mockValidateTickers).toHaveBeenCalled();
    const validateArg = mockValidateTickers.mock.calls[0][0];
    // Should contain default tickers + COIN
    expect(validateArg).toEqual(expect.arrayContaining(DEFAULT_TICKERS));
    expect(validateArg).toEqual(expect.arrayContaining(["COIN"]));
  });

  test("different ticker combos get different cache entries", async () => {
    // Request with no custom tickers
    const context1 = makeContext();
    await handler(context1, makeReq());

    // Request with custom tickers - should NOT use the first cache
    mockValidateTickers.mockImplementation(function(arr) {
      return [...new Set(arr.filter(Boolean))];
    });

    const context2 = makeContext();
    await handler(context2, makeReq({ tickers: "COIN" }));

    // Should have been called twice (different cache keys)
    expect(mockFetchAllData).toHaveBeenCalledTimes(2);
  });

  test("same ticker combo uses same cache entry", async () => {
    const context1 = makeContext();
    await handler(context1, makeReq({ tickers: "COIN" }));

    const context2 = makeContext();
    await handler(context2, makeReq({ tickers: "COIN" }));

    // Same tickers = same cache key, so only 1 fetch
    expect(mockFetchAllData).toHaveBeenCalledTimes(1);
  });

  test("ignores empty tickers query param", async () => {
    const context = makeContext();
    await handler(context, makeReq({ tickers: "" }));

    // Should use defaults, no validateTickers called with extras
    expect(mockFetchAllData).toHaveBeenCalledTimes(1);
    const callArg = mockFetchAllData.mock.calls[0][0];
    expect(callArg).toEqual(DEFAULT_TICKERS);
  });

  test("trims whitespace from tickers param", async () => {
    const context = makeContext();
    await handler(context, makeReq({ tickers: " COIN , MSTR " }));

    expect(mockValidateTickers).toHaveBeenCalled();
    const validateArg = mockValidateTickers.mock.calls[0][0];
    expect(validateArg).toEqual(expect.arrayContaining(["COIN", "MSTR"]));
  });

  test("buildCacheKey sorts tickers for consistent keys", () => {
    const key1 = handler._buildCacheKey(["AAPL", "COIN", "MSFT"]);
    const key2 = handler._buildCacheKey(["MSFT", "AAPL", "COIN"]);
    expect(key1).toBe(key2);
  });
});
