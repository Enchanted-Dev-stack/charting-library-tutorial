export function getBinanceInterval(resolution) {
    const resolutionsMap = {
      '1S': '1s',  // Use 1-second data for aggregation
      '5S': '1s',  // Stream 1-second data and aggregate manually for 5 seconds
      '10S': '1s', // Stream 1-second data and aggregate manually for 10 seconds
      '30S': '1s', // Stream 1-second data and aggregate manually for 30 seconds
      '1': '1m',   // 1-minute resolution
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '1h',
      '240': '4h',
      '1D': '1d',
      '1W': '1w',
      '1M': '1M',
    };
    return resolutionsMap[resolution] || '1s';
  }
  
  export function formatBinanceSymbol(symbol) {
    let formattedSymbol = symbol.replace('/', '').toLowerCase();
    if (formattedSymbol.endsWith('usd')) {
      formattedSymbol = formattedSymbol.replace('usd', 'usdt');
    }
    return formattedSymbol;
  }
  