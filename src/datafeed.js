// datafeed.js

import {
	subscribeOnStream,
	unsubscribeFromStream,
  } from './streaming.js';
  
  const lastBarsCache = new Map();
  
  // DatafeedConfiguration implementation
  const configurationData = {
	// Represents the resolutions for bars supported by your datafeed
	supported_resolutions: ['1', '5', '15', '30', '60', '1D', '1W', '1M'],
  
	// Exchanges (you can adjust or remove this if not needed)
	exchanges: [
	  {
		value: 'Binance',
		name: 'Binance',
		desc: 'Binance Exchange',
	  },
	],
  
	// The `symbols_types` arguments are used for the `searchSymbols` method if a user selects this symbol type
	symbols_types: [
	  {
		name: 'crypto',
		value: 'crypto',
	  },
	],
  };
  
  // Define your custom symbols
  const customSymbols = [
	{
	  symbol: 'BTC/USDT',
	  full_name: 'BTC/USDT',
	  description: 'Bitcoin vs Tether',
	  exchange: 'Binance',
	  type: 'crypto',
	},
	{
	  symbol: 'ETH/USDT',
	  full_name: 'ETH/USDT',
	  description: 'Ethereum vs Tether',
	  exchange: 'Binance',
	  type: 'crypto',
	},
  ];
  
  // Function to get all symbols (now returns custom symbols)
  function getAllSymbols() {
	return customSymbols;
  }
  
  export default {
	onReady: (callback) => {
	  console.log('[onReady]: Method call');
	  setTimeout(() => callback(configurationData));
	},
  
	searchSymbols: (
	  userInput,
	  exchange,
	  symbolType,
	  onResultReadyCallback
	) => {
	  console.log('[searchSymbols]: Method call');
	  const symbols = getAllSymbols();
	  const filteredSymbols = symbols.filter((symbol) => {
		const isExchangeValid =
		  exchange === '' || symbol.exchange === exchange;
		const isFullSymbolContainsInput =
		  symbol.full_name.toLowerCase().includes(userInput.toLowerCase());
		return isExchangeValid && isFullSymbolContainsInput;
	  });
	  onResultReadyCallback(filteredSymbols);
	},
  
	resolveSymbol: (
	  symbolName,
	  onSymbolResolvedCallback,
	  onResolveErrorCallback,
	  extension
	) => {
	  console.log('[resolveSymbol]: Method call', symbolName);
	  const symbols = getAllSymbols();
	  const symbolItem = symbols.find(
		({ full_name }) => full_name === symbolName
	  );
	  if (!symbolItem) {
		console.log('[resolveSymbol]: Cannot resolve symbol', symbolName);
		onResolveErrorCallback('cannot resolve symbol');
		return;
	  }
	  // Symbol information object
	  const symbolInfo = {
		ticker: symbolItem.full_name,
		name: symbolItem.symbol,
		description: symbolItem.description,
		type: symbolItem.type,
		session: '24x7',
		timezone: 'Etc/UTC',
		exchange: symbolItem.exchange,
		minmov: 1,
		pricescale: 100, // Adjusted for the number of decimal places
		has_intraday: true, // Set to true to enable intraday data
		has_no_volume: false, // Set to false if volume data is available
		has_weekly_and_monthly: true,
		supported_resolutions: configurationData.supported_resolutions,
		volume_precision: 8,
		data_status: 'streaming',
	  };
  
	  console.log('[resolveSymbol]: Symbol resolved', symbolName);
	  onSymbolResolvedCallback(symbolInfo);
	},
  
	getBars: async (
	  symbolInfo,
	  resolution,
	  periodParams,
	  onHistoryCallback,
	  onErrorCallback
	) => {
	  const { from, to, firstDataRequest } = periodParams;
	  console.log(
		`[getBars]: Fetching bars for ${symbolInfo.full_name}, resolution: ${resolution}`
	  );
  
	  try {
		// Convert TradingView resolution to Binance interval
		const interval = getBinanceInterval(resolution);
		const symbol = formatBinanceSymbol(symbolInfo.name).toUpperCase();
		const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}`;
		console.log(`[getBars]: Fetching data from ${url}`);
		const response = await fetch(url);
		const data = await response.json();
  
		if (data.code) {
		  // Binance API error
		  console.error(`[getBars]: Binance API error: ${data.msg}`);
		  onErrorCallback(data.msg);
		  return;
		}
  
		// Map data to TradingView format
		const bars = data.map((el) => ({
		  time: el[0], // Open time in milliseconds
		  open: parseFloat(el[1]),
		  high: parseFloat(el[2]),
		  low: parseFloat(el[3]),
		  close: parseFloat(el[4]),
		  volume: parseFloat(el[5]),
		}));
  
		// Debugging: Log the bar times
		console.log(`[getBars]: Bar times:`);
		bars.forEach(bar => {
		  console.log(`Bar time: ${bar.time}, Date: ${new Date(bar.time).toISOString()}`);
		});
  
		if (bars.length) {
		  if (firstDataRequest) {
			lastBarsCache.set(symbolInfo.full_name, bars[bars.length - 1]);
			console.log(`[getBars]: Cached last bar time: ${bars[bars.length - 1].time}`);
		  }
		  console.log(`[getBars]: Returned ${bars.length} bars`);
		  onHistoryCallback(bars, { noData: false });
		} else {
		  console.log('[getBars]: No data available for the requested range');
		  onHistoryCallback([], { noData: true });
		}
	  } catch (error) {
		console.error('[getBars]: API request failed', error);
		onErrorCallback(error);
	  }
	},
  
	subscribeBars: (
	  symbolInfo,
	  resolution,
	  onRealtimeCallback,
	  subscriberUID,
	  onResetCacheNeededCallback
	) => {
	  console.log('[subscribeBars]: Subscribing with UID:', subscriberUID);
	  subscribeOnStream(
		symbolInfo,
		resolution,
		onRealtimeCallback,
		subscriberUID,
		onResetCacheNeededCallback,
		lastBarsCache.get(symbolInfo.full_name)
	  );
	},
  
	unsubscribeBars: (subscriberUID) => {
	  console.log('[unsubscribeBars]: Unsubscribing with UID:', subscriberUID);
	  unsubscribeFromStream(subscriberUID);
	},
  };
  
  // Helper functions
  function getBinanceInterval(resolution) {
	// Map TradingView resolutions to Binance intervals
	const resolutionsMap = {
	  '1': '1m',
	  '5': '5m',
	  '15': '15m',
	  '30': '30m',
	  '60': '1h',
	  '240': '4h',
	  '1D': '1d',
	  '1W': '1w',
	  '1M': '1M',
	};
	return resolutionsMap[resolution] || '1m';
  }
  
  function formatBinanceSymbol(symbol) {
	// Convert symbol from 'BTC/USDT' to 'BTCUSDT' as per Binance's format
	let formattedSymbol = symbol.replace('/', '').toUpperCase();
	// Handle 'USD' to 'USDT' conversion if needed
	if (formattedSymbol.endsWith('USD')) {
	  formattedSymbol = formattedSymbol.replace('USD', 'USDT');
	}
	return formattedSymbol;
  }
  