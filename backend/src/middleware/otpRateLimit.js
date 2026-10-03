const requests = new Map();
const WINDOW = 15 * 60 * 1000;

module.exports = function otpRateLimit(req, res, next) {
  const now = Date.now();
  // ponytail: bounded per-process IP limiter; use a shared store when running multiple API workers.
  if (requests.size >= 10000) {
    for (const [key, entry] of requests) if (entry.resetAt <= now) requests.delete(key);
  }
  let entry = requests.get(req.ip);
  if (!entry || entry.resetAt <= now) {
    if (requests.size >= 10000 && !entry) return res.status(503).json({ success: false, message: 'Verification is busy. Try again later.' });
    entry = { count: 0, resetAt: now + WINDOW };
    requests.set(req.ip, entry);
  }
  if (++entry.count > 60) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, message: 'Too many verification requests. Try again later.' });
  }
  next();
};
