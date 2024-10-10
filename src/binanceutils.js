export function getBinanceInterval(resolution) {
  const resolutionsMap = {
    "1S": "1s", // Use 1-second data for aggregation
    "5S": "1s", // Stream 1-second data and aggregate manually for 5 seconds
    "10S": "1s", // Stream 1-second data and aggregate manually for 10 seconds
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "1h"
  };
  return resolutionsMap[resolution] || "1m";
}

export function formatBinanceSymbol(symbol) {
  return symbol.toLowerCase().replace('/', '');
}
