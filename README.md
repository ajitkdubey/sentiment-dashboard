# ⚡ OpenEXA Sentiment Dashboard

Real-time sentiment analysis dashboard for 20 tickers using Yahoo Finance and Google News.

![CI](https://github.com/ajitkdubey/sentiment-dashboard/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/ajitkdubey/sentiment-dashboard/actions/workflows/deploy.yml/badge.svg)

## Tickers

**BTC ETFs:** IBIT, GBTC, FBTC, ARKB, BITB, HODL, BRRR  
**Gold:** GLD, IAU  
**Index ETFs:** SPY, QQQ, IVV  
**Crypto:** BTC  
**Tech:** AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL

## Features

- **Overview** — Price cards with sentiment meters and top news per ticker
- **Sentiment Heatmap** — Color-coded bullish/bearish/neutral grid at a glance
- **All News** — Combined feed sorted by time with per-article sentiment scores
- **Detail View** — Click any ticker for full stats + all articles
- Auto-refreshes every 10 minutes (manual refresh button available)

## Quick Start

```bash
npm install
npm start
# → http://localhost:3456
```

## Docker

```bash
docker build -t sentiment-dashboard .
docker run -p 3456:3456 sentiment-dashboard
```

## Architecture

```
sentiment-dashboard/
├── server.js              # Express backend (Yahoo Finance + Google News + NLP)
├── public/
│   └── index.html         # Single-page frontend (vanilla JS, no build step)
├── Dockerfile             # Production container
├── .github/workflows/
│   ├── ci.yml             # CI pipeline
│   └── deploy.yml         # Azure deployment pipeline
└── package.json
```

## License

Private — OpenEXA INC
