import { getBinanceInterval, formatBinanceSymbol } from './binanceutils.js';

const channelToSubscription = new Map();
let buffer = [];
let lastTime = null;

// Helper to convert UTC time to Asia/Kolkata time
function convertToIndiaTime(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
}

export function subscribeOnStream(
  symbolInfo,
  resolution,
  onRealtimeCallback,
  subscriberUID,
  onResetCacheNeededCallback,
  lastBar
) {
  const existingSubscription = channelToSubscription.get(subscriberUID);
  
  // Close previous WebSocket if already subscribed
  if (existingSubscription) {
    unsubscribeFromStream(subscriberUID);
  }

  const symbol = formatBinanceSymbol(symbolInfo.name);
  const interval = getBinanceInterval(resolution);

  const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
  console.log(`[subscribeOnStream]: Connecting to ${wsUrl} for resolution ${resolution}`);

  const socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    console.log('[socket] Connected');
  });

  socket.addEventListener('close', (event) => {
    console.log('[socket] Disconnected:', event);
  });

  socket.addEventListener('error', (error) => {
    console.log('[socket] Error:', error);
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.e === 'kline') {
      const kline = data.k;
      const bar = {
        time: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
      };

      if (resolution === '5S' || resolution === '10S') {
        aggregateData(bar, resolution, onRealtimeCallback);
      } else if (kline.x) {
        onRealtimeCallback(bar);
      }
    }
  });

  channelToSubscription.set(subscriberUID, { socket, resolution, onRealtimeCallback });
}

function aggregateData(bar, resolution, onRealtimeCallback) {
  const aggregationInterval = resolution === '5S' ? 5000 : 10000;
  const currentTime = Math.floor(bar.time / aggregationInterval) * aggregationInterval;

  if (lastTime === null || currentTime === lastTime) {
    buffer.push(bar);
  } else {
    const aggregatedBar = {
      time: lastTime,
      open: buffer[0].open,
      high: Math.max(...buffer.map(b => b.high)),
      low: Math.min(...buffer.map(b => b.low)),
      close: buffer[buffer.length - 1].close,
      volume: buffer.reduce((sum, b) => sum + b.volume, 0),
    };

    onRealtimeCallback(aggregatedBar);
    buffer = [bar];
  }

  lastTime = currentTime;
}

export function unsubscribeFromStream(subscriberUID) {
  const subscription = channelToSubscription.get(subscriberUID);
  if (subscription) {
    const socket = subscription.socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
      console.log('[unsubscribeBars]: Socket closed for subscriberUID:', subscriberUID);
    }
    channelToSubscription.delete(subscriberUID);
    console.log('[unsubscribeBars]: Unsubscribed with subscriberUID:', subscriberUID);
  }
}
