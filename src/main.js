// Datafeed implementation
import Datafeed from './datafeed.js';

window.tvWidget = new TradingView.widget({
	symbol: 'BTC/USDT',  // Default symbol
	interval: '1S',      // Set default to 1-second interval
	fullscreen: true,    // Displays the chart in fullscreen mode
	container: 'tv_chart_container',
	datafeed: Datafeed,
	supported_resolutions: ['1S', '1', '5', '15', '30', '60', 'D'],  // Include 1-second resolution
	enabled_features: ['seconds_resolution'],  // Enable seconds resolution support
	timezone: 'Asia/Kolkata',
	library_path: '../charting_library_cloned_data/charting_library/',
});
