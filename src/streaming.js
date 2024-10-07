// streaming.js

const channelToSubscription = new Map();

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

      if (kline.x) {  // Only process closed klines
        const bar = {
          time: kline.t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };

        onRealtimeCallback(bar);
      }
    }
  });

  channelToSubscription.set(subscriberUID, { socket, resolution, onRealtimeCallback });
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
  return resolutionsMap[resolution] || '1m';
}

function formatBinanceSymbol(symbol) {
  let formattedSymbol = symbol.replace('/', '').toLowerCase();
  if (formattedSymbol.endsWith('usd')) {
    formattedSymbol = formattedSymbol.replace('usd', 'usdt');
  }
  return formattedSymbol;
}
