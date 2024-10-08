// datafeed.js

import { subscribeOnStream, unsubscribeFromStream } from './streaming.js';
import { getBinanceInterval, formatBinanceSymbol } from './binanceutils.js';

const lastBarsCache = new Map();

// DatafeedConfiguration implementation
const configurationData = {
  supported_resolutions: ['1S', '5S', '10S', '30S', '1', '5', '15', '30', '60'],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
  has_seconds: true,
  exchanges: [
    { value: 'Custom API', name: 'Custom API', desc: 'Custom API Exchange' },
  ],
  symbols_types: [{ name: 'crypto', value: 'crypto' }],
};

// Define your custom symbols
const customSymbols = [
  { symbol: 'BTC/USDT', full_name: 'BTC/USDT', exchange: 'Custom API', type: 'crypto' },
];

// Function to get all symbols
function getAllSymbols() {
  return customSymbols;
}

export default {
  onReady: (callback) => {
    console.log('[onReady]: Method call');
    setTimeout(() => callback(configurationData), 0);
  },

  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
    console.log('[searchSymbols]: Method call');
    const symbols = getAllSymbols();
    const filteredSymbols = symbols.filter((symbol) => {
      const isExchangeValid = exchange === '' || symbol.exchange === exchange;
      const isFullSymbolContainsInput = symbol.full_name.toLowerCase().includes(userInput.toLowerCase());
      return isExchangeValid && isFullSymbolContainsInput;
    });
    onResultReadyCallback(filteredSymbols);
  },

  resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
    console.log('[resolveSymbol]: Method call', symbolName);
    const symbols = getAllSymbols();
    const symbolItem = symbols.find(({ full_name }) => full_name === symbolName);

    if (!symbolItem) {
      console.log('[resolveSymbol]: Cannot resolve symbol', symbolName);
      onResolveErrorCallback('cannot resolve symbol');
      return;
    }

    const symbolInfo = {
      ticker: symbolItem.full_name,
      name: symbolItem.symbol,
      type: symbolItem.type,
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: symbolItem.exchange,
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      supported_resolutions: configurationData.supported_resolutions,
      has_seconds: true,
      volume_precision: 8,
      data_status: 'streaming',
    };

    console.log('[resolveSymbol]: Symbol resolved', symbolName);
    onSymbolResolvedCallback(symbolInfo);
  },

  getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
    const { from, to, firstDataRequest } = periodParams;
    console.log(`[getBars]: Fetching bars for ${symbolInfo.full_name}, resolution: ${resolution}`);
  
    try {
      // Use your custom API instead of Binance API
      const url = `http://localhost:8000/api/v1/stockData?symbol=${symbolInfo.name}&resolution=${resolution}&from=${from}&to=${to}`;
      console.log(`[getBars]: Fetching data from ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
  
      if (!data.length) {
        console.log('[getBars]: No data available for the requested range');
        onHistoryCallback([], { noData: true });
        return;
      }
  
      // Map the custom API data format to TradingView format
      const bars = data.map((el) => ({
        time: el.time * 1000,  // Assuming `el.time` is in seconds, multiply by 1000 for milliseconds
        open: parseFloat(el.open),
        high: parseFloat(el.high),
        low: parseFloat(el.low),
        close: parseFloat(el.close),
        volume: parseFloat(el.volume),
      }));
  
      if (firstDataRequest) {
        lastBarsCache.set(symbolInfo.full_name, bars[bars.length - 1]);
      }
  
      console.log(`[getBars]: Returned ${bars.length} bars`);
      onHistoryCallback(bars, { noData: false });
    } catch (error) {
      console.error('[getBars]: API request failed', error);
      onErrorCallback(error);
    }
  },
  
  subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
    console.log('[subscribeBars]: Subscribing with UID:', subscriberUID);
    subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback, lastBarsCache.get(symbolInfo.full_name));
  },

  unsubscribeBars: (subscriberUID) => {
    console.log('[unsubscribeBars]: Unsubscribing with UID:', subscriberUID);
    unsubscribeFromStream(subscriberUID);
  },
};
