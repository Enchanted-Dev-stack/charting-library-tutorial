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
  const symbol = formatBinanceSymbol(symbolInfo.name);
  const interval = getBinanceInterval(resolution);

  if (interval !== '1s' && interval !== '1m') {
    console.error(`[subscribeOnStream]: Invalid interval for streaming: ${interval}`);
    return;
  }

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

      // Debug log to print the time of the received kline (candle) in Asia/Kolkata time
      const indiaTime = convertToIndiaTime(kline.t);
      console.log(`[socket message]: Received kline at India time: ${indiaTime} | UTC time: ${new Date(kline.t).toISOString()} | open: ${bar.open}, close: ${bar.close}`);

      if (resolution === '5S' || resolution === '10S') {
        console.log(`[aggregateData]: Aggregating for resolution ${resolution}`);
        aggregateData(bar, resolution, onRealtimeCallback);
      } else if (kline.x) {
        console.log(`[onRealtimeCallback]: Sending new bar for India time: ${indiaTime}`);
        onRealtimeCallback(bar);
      }
    }
  });

  channelToSubscription.set(subscriberUID, { socket, resolution, onRealtimeCallback });
}

function aggregateData(bar, resolution, onRealtimeCallback) {
  const aggregationInterval = resolution === '5S' ? 5000 : 10000;
  const currentTime = Math.floor(bar.time / aggregationInterval) * aggregationInterval;

  const indiaTime = convertToIndiaTime(bar.time);
  console.log(`[aggregateData]: Bar time: India time: ${indiaTime} | Aggregated time: ${convertToIndiaTime(currentTime)}`);

  if (lastTime === null || currentTime === lastTime) {
    console.log(`[aggregateData]: Pushing bar to buffer at India time: ${indiaTime}`);
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

    console.log(`[aggregateData]: Aggregated bar | Time: India time: ${convertToIndiaTime(aggregatedBar.time)} | open: ${aggregatedBar.open}, close: ${aggregatedBar.close}`);
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
