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
  const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;

  console.log(`[subscribeOnStream]: Connecting to ${wsUrl}`);

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
    // console.log('[socket] Message:', data);

    // Check if the event is a kline event
    if (data.e === 'kline') {
      const kline = data.k;

      // Process only if the kline is closed (final)
      if (kline.x) {
        // Extract relevant data from the kline
        const bar = {
          time: kline.t, // Kline start time in milliseconds
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };

        console.log(`[socket] Received closed kline bar:`, bar);

        // Find the subscription for this subscriber
        const subscriptionItem = channelToSubscription.get(subscriberUID);
        if (subscriptionItem) {
          const previousBarTime = subscriptionItem.lastBar ? subscriptionItem.lastBar.time : null;

          if (previousBarTime && bar.time <= previousBarTime) {
            console.error(
              `Time order violation, prev: ${new Date(previousBarTime).toISOString()}, cur: ${new Date(bar.time).toISOString()}`
            );
            return;
          }

          // Update the last bar
          subscriptionItem.lastBar = bar;

          // Send the bar to the subscribed callback
          subscriptionItem.onRealtimeCallback(bar);
        } else {
          console.log('[socket] No subscription found for subscriberUID:', subscriberUID);
        }
      } else {
        // Kline is not closed yet; ignore for now
        // console.log('[socket] Kline not closed yet; ignoring');
      }
    } else {
      console.log('[socket] Received non-kline message:', data);
    }
  });

  // Save the subscription
  channelToSubscription.set(subscriberUID, {
    socket,
    symbolInfo,
    resolution,
    onRealtimeCallback,
    lastBar,
  });

  console.log('[subscribeOnStream]: Subscription saved for subscriberUID:', subscriberUID);
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
  } else {
    console.log('[unsubscribeBars]: No subscription found for subscriberUID:', subscriberUID);
  }
}

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
  // Convert symbol from 'BTC/USDT' to 'btcusdt' as per Binance's format
  let formattedSymbol = symbol.replace('/', '').toLowerCase();
  // Handle 'USD' to 'USDT' conversion if needed
  if (formattedSymbol.endsWith('usd')) {
    formattedSymbol = formattedSymbol.replace('usd', 'usdt');
  }
  return formattedSymbol;
}
