const { fetchAllData, getTickersFromEnv, validateTickers } = require("../shared");

// Per-ticker-combo cache: Map<sortedTickerKey, {data, time}>
const cacheMap = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function buildCacheKey(tickers) {
  return tickers.slice().sort().join(",");
}

module.exports = async function (context, req) {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === "true";

    // Determine ticker list: merge defaults with any custom tickers from query
    var baseTickers = getTickersFromEnv();
    var extraParam = req.query.tickers;
    var allTickers;
    if (extraParam && extraParam.trim()) {
      var extras = extraParam.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
      // Merge: defaults + extras, deduplicated via validateTickers
      allTickers = validateTickers(baseTickers.concat(extras));
    } else {
      allTickers = baseTickers;
    }

    var cacheKey = buildCacheKey(allTickers);
    var cached = cacheMap.get(cacheKey);

    if (!cached || (now - cached.time) > CACHE_TTL || forceRefresh) {
      var data = await fetchAllData(allTickers);
      cacheMap.set(cacheKey, { data: data, time: now });
      cached = { data: data, time: now };
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cached.data),
    };
  } catch (e) {
    context.res = {
      status: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};

// Expose for testing
module.exports._cacheMap = cacheMap;
module.exports._buildCacheKey = buildCacheKey;
