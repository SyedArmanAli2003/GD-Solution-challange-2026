const rateStore = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimitPost(req, res, next) {
  if (req.method !== 'POST') return next();
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  
  if (!rateStore.has(ip)) rateStore.set(ip, []);
  let timestamps = rateStore.get(ip).filter(t => t > windowStart);
  
  if (timestamps.length >= RATE_LIMIT) {
    console.warn(`[RateLimit] BLOCKED POST from ${ip} — ${timestamps.length} hits in window`);
    return res.status(429).json({
      error: 'Too many reports from this device. If this is a real emergency, please call your local emergency number directly.',
      retryAfterMs: timestamps[0] + RATE_WINDOW_MS - now
    });
  }
  
  timestamps.push(now);
  rateStore.set(ip, timestamps);
  
  // Cleanup store to prevent memory leak
  if (rateStore.size > 10000) {
    for (const [key, vals] of rateStore) {
      if (vals.length === 0 || (now - Math.max(...vals)) > RATE_WINDOW_MS * 2) {
        rateStore.delete(key);
      }
    }
  }
  next();
}

module.exports = { rateLimitPost };
