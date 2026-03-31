const { fetchAllData } = require("../shared");

// Simple in-memory cache (persists across warm invocations)
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

module.exports = async function (context, req) {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === "true";

    if (!cache || (now - cacheTime) > CACHE_TTL || forceRefresh) {
      cache = await fetchAllData();
      cacheTime = now;
    }

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cache),
    };
  } catch (e) {
    context.res = {
      status: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
