// datafeed.js

import {
	subscribeOnStream,
	unsubscribeFromStream,
} from './streaming.js';

const lastBarsCache = new Map();

// DatafeedConfiguration implementation
const configurationData = {
	// Represents the resolutions for bars supported by your datafeed
	supported_resolutions: ['1S', '1', '5', '15', '30', '60'],  // Ensure 1S is included
	supports_marks: false,
	supports_timescale_marks: false,
	supports_time: true,
	has_seconds: true,  // Support for second-level data
	exchanges: [
		{
			value: 'Binance',
			name: 'Binance',
			desc: 'Binance Exchange',
		},
	],
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
		exchange: 'Binance',
		type: 'crypto',
	},
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
			const isFullSymbolContainsInput =
				symbol.full_name.toLowerCase().includes(userInput.toLowerCase());
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
			has_no_volume: false,
			has_weekly_and_monthly: true,
			supported_resolutions: configurationData.supported_resolutions,  // 1S support
			has_seconds: true,  // Support for second-level data
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
			// Ensure 1-second resolution is properly converted to Binance's '1s'
			const interval = getBinanceInterval(resolution);
			console.log(`[getBars]: Binance interval: ${interval}`);
			const symbol = formatBinanceSymbol(symbolInfo.name).toUpperCase();
			const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}`;
			console.log(`[getBars]: Fetching data from ${url}`);
			const response = await fetch(url);
			const data = await response.json();

			if (data.code) {
				console.error(`[getBars]: Binance API error: ${data.msg}`);
				onErrorCallback(data.msg);
				return;
			}

			// Map data to TradingView format
			const bars = data.map((el) => ({
				time: el[0],  // Open time in milliseconds
				open: parseFloat(el[1]),
				high: parseFloat(el[2]),
				low: parseFloat(el[3]),
				close: parseFloat(el[4]),
				volume: parseFloat(el[5]),
			}));

			if (bars.length) {
				if (firstDataRequest) {
					lastBarsCache.set(symbolInfo.full_name, bars[bars.length - 1]);
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

	subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
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
	const resolutionsMap = {
		'1S': '1s',  // 1-second resolution for Binance
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
	return resolutionsMap[resolution] || '1m';  // Fallback to 1-minute if not found
}

function formatBinanceSymbol(symbol) {
	let formattedSymbol = symbol.replace('/', '').toLowerCase();
	if (formattedSymbol.endsWith('usd')) {
		formattedSymbol = formattedSymbol.replace('usd', 'usdt');
	}
	return formattedSymbol;
}
