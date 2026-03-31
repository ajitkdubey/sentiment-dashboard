// Frontend logic for the OpenEXA Sentiment Dashboard
// Extracted for testability — also loaded by index.html

(function(exports) {
  "use strict";

  // ── State ──
  var DATA = null;
  var currentTab = "overview";
  var selectedTicker = null;

  // ── Helpers ──
  function sentColor(label) {
    if (label === "Bullish") return "var(--green)";
    if (label === "Bearish") return "var(--red)";
    return "var(--yellow)";
  }

  function timeAgo(dateStr) {
    if (!dateStr) return "";
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + "m ago";
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.floor(hrs / 24) + "d ago";
  }

  function formatNum(n) {
    if (n == null) return "N/A";
    if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
  }

  function heatBg(score) {
    if (score > 2) return "rgba(16,185,129,0.3)";
    if (score > 0.5) return "rgba(16,185,129,0.15)";
    if (score < -2) return "rgba(239,68,68,0.3)";
    if (score < -0.5) return "rgba(239,68,68,0.15)";
    return "rgba(245,158,11,0.1)";
  }

  // ── Fetch ──
  async function loadData() {
    try {
      var res = await fetch("/api/data");
      DATA = await res.json();
      if (typeof DATA === "string") DATA = JSON.parse(DATA);
      document.getElementById("lastUpdate").textContent =
        DATA.lastUpdate ? "Updated: " + new Date(DATA.lastUpdate).toLocaleTimeString() : "";
      renderSummary();
      renderTab();
    } catch (e) {
      document.getElementById("mainContent").innerHTML =
        '<div class="loading">Error loading data: ' + e.message + '</div>';
    }
  }

  async function doRefresh() {
    var btn = document.getElementById("refreshBtn");
    btn.disabled = true;
    btn.textContent = "Refreshing...";
    try {
      await fetch("/api/data?refresh=true");
      await loadData();
    } finally {
      btn.disabled = false;
      btn.textContent = "↻ Refresh";
    }
  }

  // ── Summary strip ──
  function renderSummary() {
    var strip = document.getElementById("summaryStrip");
    var tickers = Object.keys(DATA.quotes);
    strip.innerHTML = tickers.map(function(t) {
      var q = DATA.quotes[t];
      var n = DATA.news[t];
      var sentLabel = (n && n.aggregate && n.aggregate.label) || "N/A";
      var changeClass = (q.change || 0) >= 0 ? "positive" : "negative";
      var sign = (q.change || 0) >= 0 ? "+" : "";
      return '<div class="summary-card ' + (selectedTicker === t ? 'selected' : '') + '" onclick="App.selectTicker(\'' + t + '\')">' +
        '<div class="summary-symbol">' + t + '</div>' +
        '<div class="summary-price">' + (q.price != null ? '$' + q.price.toFixed(2) : 'N/A') + '</div>' +
        '<div class="summary-change ' + changeClass + '">' +
          (q.changePercent != null ? sign + q.changePercent.toFixed(2) + '%' : '') +
        '</div>' +
        '<span class="summary-sentiment sentiment-' + sentLabel.replace('/','-') + '">' + sentLabel + '</span>' +
      '</div>';
    }).join("");
  }

  function selectTicker(t) {
    selectedTicker = selectedTicker === t ? null : t;
    renderSummary();
    renderTab();
  }

  // ── Tabs ──
  function renderTab() {
    if (!DATA) return;
    var main = document.getElementById("mainContent");
    if (selectedTicker) {
      main.innerHTML = renderDetail(selectedTicker);
      return;
    }
    switch (currentTab) {
      case "overview": main.innerHTML = renderOverview(); break;
      case "heatmap": main.innerHTML = renderHeatmap(); break;
      case "news": main.innerHTML = renderAllNews(); break;
    }
  }

  function setTab(tab) {
    currentTab = tab;
    selectedTicker = null;
    renderSummary();
    renderTab();
  }

  // ── Overview ──
  function renderOverview() {
    var tickers = Object.keys(DATA.quotes);
    return '<div class="overview-grid">' + tickers.map(function(t) { return renderTickerCard(t); }).join("") + '</div>';
  }

  function renderTickerCard(t) {
    var q = DATA.quotes[t];
    var n = DATA.news[t];
    var changeClass = (q.change || 0) >= 0 ? "positive" : "negative";
    var sign = (q.change || 0) >= 0 ? "+" : "";
    var sentLabel = (n && n.aggregate && n.aggregate.label) || "N/A";
    var sentScore = (n && n.aggregate && n.aggregate.avgScore) || 0;
    var meterPct = Math.max(0, Math.min(100, ((sentScore + 5) / 10) * 100));
    var meterColor = sentScore > 1 ? "var(--green)" : sentScore < -1 ? "var(--red)" : "var(--yellow)";
    var topNews = ((n && n.articles) || []).slice(0, 3);

    var newsHtml = '';
    if (topNews.length) {
      newsHtml = '<div class="news-section"><h3>Latest News</h3>' +
        topNews.map(function(a) {
          return '<div class="news-item">' +
            '<a href="' + a.link + '" target="_blank">' + a.title + '</a>' +
            '<div class="news-meta">' +
              '<span class="news-sentiment-dot" style="background:' + sentColor(a.sentiment.label) + '"></span>' +
              a.sentiment.label + ' · ' + timeAgo(a.pubDate) +
            '</div></div>';
        }).join("") + '</div>';
    }

    return '<div class="ticker-card">' +
      '<div class="ticker-header"><div>' +
        '<div class="ticker-name">' + t + '</div>' +
        '<div class="ticker-change ' + changeClass + '">' +
          (q.change != null ? sign + q.change.toFixed(2) : '') + ' ' +
          '(' + (q.changePercent != null ? sign + q.changePercent.toFixed(2) + '%' : 'N/A') + ')' +
        '</div></div>' +
        '<div class="ticker-price">' + (q.price != null ? '$' + q.price.toFixed(2) : 'N/A') + '</div>' +
      '</div>' +
      '<div class="sentiment-meter">' +
        '<div class="meter-label">Sentiment Score</div>' +
        '<div class="meter-bar-bg"><div class="meter-bar" style="width:' + meterPct + '%;background:' + meterColor + '"></div></div>' +
        '<div class="meter-value"><span>Bearish</span><span class="sentiment-' + sentLabel + '">' + sentLabel + ' (' + sentScore + ')</span><span>Bullish</span></div>' +
      '</div>' + newsHtml + '</div>';
  }

  // ── Heatmap ──
  function renderHeatmap() {
    var tickers = Object.keys(DATA.news);
    return '<div class="heatmap-grid">' + tickers.map(function(t) {
      var n = DATA.news[t];
      var score = (n && n.aggregate && n.aggregate.avgScore) || 0;
      var label = (n && n.aggregate && n.aggregate.label) || "N/A";
      var bg = heatBg(score);
      return '<div class="heat-cell" style="background:' + bg + '" onclick="App.selectTicker(\'' + t + '\')">' +
        '<div class="heat-symbol">' + t + '</div>' +
        '<div class="heat-score">' + (score > 0 ? '+' : '') + score + '</div>' +
        '<div class="heat-label">' + label + ' · ' + ((n && n.aggregate && n.aggregate.articleCount) || 0) + ' articles</div>' +
      '</div>';
    }).join("") + '</div>';
  }

  // ── All News ──
  function renderAllNews() {
    var allArticles = [];
    Object.keys(DATA.news).forEach(function(t) {
      ((DATA.news[t] && DATA.news[t].articles) || []).forEach(function(a) {
        allArticles.push(Object.assign({}, a, { ticker: t }));
      });
    });
    allArticles.sort(function(a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });

    return '<div class="detail-panel">' +
      '<h2 style="margin-bottom:16px">All News (' + allArticles.length + ' articles)</h2>' +
      '<table class="news-table"><thead><tr><th>Ticker</th><th>Headline</th><th>Sentiment</th><th>Time</th></tr></thead><tbody>' +
      allArticles.map(function(a) {
        return '<tr><td><strong>' + a.ticker + '</strong></td>' +
          '<td><a href="' + a.link + '" target="_blank">' + a.title + '</a></td>' +
          '<td><span class="news-sentiment-dot" style="background:' + sentColor(a.sentiment.label) + '"></span> ' +
            a.sentiment.label + ' (' + a.sentiment.score + ')</td>' +
          '<td>' + timeAgo(a.pubDate) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  // ── Detail view ──
  function renderDetail(t) {
    var q = DATA.quotes[t] || {};
    var n = DATA.news[t] || {};
    var changeClass = (q.change || 0) >= 0 ? "positive" : "negative";
    var sign = (q.change || 0) >= 0 ? "+" : "";

    return '<div class="detail-panel">' +
      '<div class="detail-header"><div>' +
        '<div class="detail-title">' + t + '</div>' +
        '<div class="ticker-change ' + changeClass + '" style="font-size:16px">' +
          '$' + (q.price ? q.price.toFixed(2) : 'N/A') + ' · ' + sign + (q.changePercent ? q.changePercent.toFixed(2) : 0) + '%' +
        '</div></div>' +
        '<span class="summary-sentiment sentiment-' + ((n.aggregate && n.aggregate.label) || 'N/A').replace('/','-') + '" style="font-size:16px;padding:6px 16px">' +
          ((n.aggregate && n.aggregate.label) || 'N/A') + ' (score: ' + ((n.aggregate && n.aggregate.avgScore) || 0) + ')' +
        '</span></div>' +
      '<div class="detail-stats">' +
        '<div class="stat-box"><div class="stat-label">Day High</div><div class="stat-value">$' + (q.dayHigh ? q.dayHigh.toFixed(2) : 'N/A') + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">Day Low</div><div class="stat-value">$' + (q.dayLow ? q.dayLow.toFixed(2) : 'N/A') + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">Prev Close</div><div class="stat-value">$' + (q.prevClose ? q.prevClose.toFixed(2) : 'N/A') + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">Volume</div><div class="stat-value">' + formatNum(q.volume) + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">Market Cap</div><div class="stat-value">' + formatNum(q.marketCap) + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">50D Avg</div><div class="stat-value">$' + (q.fiftyDayAvg ? q.fiftyDayAvg.toFixed(2) : 'N/A') + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">200D Avg</div><div class="stat-value">$' + (q.twoHundredDayAvg ? q.twoHundredDayAvg.toFixed(2) : 'N/A') + '</div></div>' +
        '<div class="stat-box"><div class="stat-label">Articles</div><div class="stat-value">' + ((n.aggregate && n.aggregate.articleCount) || 0) + '</div></div>' +
      '</div>' +
      '<h3 style="margin:16px 0 8px;font-size:14px;color:var(--muted)">NEWS & SENTIMENT</h3>' +
      '<table class="news-table"><thead><tr><th>Headline</th><th>Sentiment</th><th>Score</th><th>Time</th></tr></thead><tbody>' +
      ((n.articles || []).map(function(a) {
        return '<tr><td><a href="' + a.link + '" target="_blank">' + a.title + '</a></td>' +
          '<td><span class="news-sentiment-dot" style="background:' + sentColor(a.sentiment.label) + '"></span> ' + a.sentiment.label + '</td>' +
          '<td>' + a.sentiment.score + '</td>' +
          '<td>' + timeAgo(a.pubDate) + '</td></tr>';
      }).join("")) + '</tbody></table></div>';
  }

  // ── Exports ──
  exports.DATA = DATA;
  exports.sentColor = sentColor;
  exports.timeAgo = timeAgo;
  exports.formatNum = formatNum;
  exports.heatBg = heatBg;
  exports.loadData = loadData;
  exports.doRefresh = doRefresh;
  exports.renderSummary = renderSummary;
  exports.renderOverview = renderOverview;
  exports.renderHeatmap = renderHeatmap;
  exports.renderAllNews = renderAllNews;
  exports.renderDetail = renderDetail;
  exports.renderTickerCard = renderTickerCard;
  exports.renderTab = renderTab;
  exports.selectTicker = selectTicker;
  exports.setTab = setTab;
  // Expose state getters/setters for testing
  exports.getDATA = function() { return DATA; };
  exports.setDATA = function(d) { DATA = d; };
  exports.getCurrentTab = function() { return currentTab; };
  exports.setCurrentTab = function(t) { currentTab = t; };
  exports.getSelectedTicker = function() { return selectedTicker; };
  exports.setSelectedTicker = function(s) { selectedTicker = s; };

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.App = {}));
