const mockFetchAllData = jest.fn();

jest.mock("../shared", () => ({
  fetchAllData: mockFetchAllData,
}));

const MOCK_RESPONSE = {
  quotes: { AAPL: { symbol: "AAPL", price: 150 } },
  news: { AAPL: { symbol: "AAPL", articles: [] } },
  lastUpdate: "2024-01-01T00:00:00.000Z",
};

describe("handler (data/index.js)", () => {
  let handler;

  // We need a fresh module for each test to reset the module-level cache
  beforeEach(() => {
    jest.resetModules();
    mockFetchAllData.mockReset();
    mockFetchAllData.mockResolvedValue(MOCK_RESPONSE);
    // Re-require to get fresh cache/cacheTime
    jest.mock("../shared", () => ({
      fetchAllData: mockFetchAllData,
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

    // fetchAllData should only be called once (second call uses cache)
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
});
