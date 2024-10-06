import {
	makeApiRequest,
	generateSymbol,
	parseFullSymbol,
  } from './helpers.js';
  import {
	subscribeOnStream,
	unsubscribeFromStream,
  } from './streaming.js';
  
  const lastBarsCache = new Map();
  
  // DatafeedConfiguration implementation
  const configurationData = {
	// Represents the resolutions for bars supported by your datafeed
	supported_resolutions: ['1S', '1', '5', '15', '30', '60', '1D', '1W', '1M'],
  
	// The `exchanges` arguments are used for the `searchSymbols` method if a user selects the exchange
	exchanges: [
	  {
		value: 'Bitfinex',
		name: 'Bitfinex',
		desc: 'Bitfinex',
	  },
	  {
		value: 'Kraken',
		// Filter name
		name: 'Kraken',
		// Full exchange name displayed in the filter popup
		desc: 'Kraken bitcoin exchange',
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
  
  // Obtains all symbols for all exchanges supported by CryptoCompare API
  async function getAllSymbols() {
	const data = await makeApiRequest('data/v3/all/exchanges');
	let allSymbols = [];
  
	for (const exchange of configurationData.exchanges) {
	  const pairs = data.Data[exchange.value].pairs;
  
	  for (const leftPairPart of Object.keys(pairs)) {
		const symbols = pairs[leftPairPart].map((rightPairPart) => {
		  const symbol = generateSymbol(
			exchange.value,
			leftPairPart,
			rightPairPart
		  );
		  return {
			symbol: symbol.short,
			full_name: symbol.full,
			description: symbol.short,
			exchange: exchange.value,
			type: 'crypto',
		  };
		});
		allSymbols = [...allSymbols, ...symbols];
	  }
	}
	return allSymbols;
  }
  
  export default {
	onReady: (callback) => {
	  console.log('[onReady]: Method call');
	  setTimeout(() => callback(configurationData));
	},
  
	searchSymbols: async (
	  userInput,
	  exchange,
	  symbolType,
	  onResultReadyCallback
	) => {
	  console.log('[searchSymbols]: Method call');
	  const symbols = await getAllSymbols();
	  const newSymbols = symbols.filter((symbol) => {
		const isExchangeValid =
		  exchange === '' || symbol.exchange === exchange;
		const isFullSymbolContainsInput =
		  symbol.full_name.toLowerCase().includes(userInput.toLowerCase());
		return isExchangeValid && isFullSymbolContainsInput;
	  });
	  onResultReadyCallback(newSymbols);
	},
  
	resolveSymbol: async (
	  symbolName,
	  onSymbolResolvedCallback,
	  onResolveErrorCallback,
	  extension
	) => {
	  console.log('[resolveSymbol]: Method call', symbolName);
	  const symbols = await getAllSymbols();
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
		pricescale: 100000000, // Adjusted for higher precision
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
		// Fetch data from your API with resolution and time range
		const url = `http://localhost:8000/api/v1/stockData?resolution=${resolution}&from=${from}&to=${to}`;
		console.log(`[getBars]: Fetching data from ${url}`);
		const response = await fetch(url);
		const data = await response.json();
		console.log(data)
  
		// Map data to TradingView format
		const bars = data.map((bar) => ({
		  time: bar.time * 1000, // Convert seconds to milliseconds
		  open: bar.open,
		  high: bar.high,
		  low: bar.low,
		  close: bar.close,
		  volume: bar.volume || 0,
		}));
  
		if (bars.length) {
		  if (firstDataRequest) {
			lastBarsCache.set(symbolInfo.full_name, bars[bars.length - 1]);
		  }
		  console.log(`[getBars]: returned ${bars.length} bars`);
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
  