/**
 * Fast DNS for slow networks (venue Wi-Fi): the OS resolver was taking ~11s per hostname,
 * which made every Cloudinary upload / Gemini call time out. This routes Node's dns.lookup
 * through public DNS (8.8.8.8 / 1.1.1.1) with a small TTL cache, and falls back to the
 * normal OS lookup on any failure — so it can never make things worse.
 *
 * Skipped for localhost / IPs / IPv6-only requests, on Render (RENDER env is set there),
 * or when PUBLIC_DNS=off.
 */
const dns = require('dns');
const net = require('net');

const originalLookup = dns.lookup;
const MIN_TTL_S = 30;

function install() {
  if (dns.lookup.__fastDns) return;
  if (process.env.RENDER || String(process.env.PUBLIC_DNS).toLowerCase() === 'off') return;

  const resolver = new dns.Resolver({ timeout: 2000, tries: 1 });
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  const cache = new Map(); // hostname -> { addresses, expires }

  function fastLookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    } else if (typeof options === 'number') {
      options = { family: options };
    }
    options = options || {};
    const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family;

    const passThrough = () => originalLookup.call(dns, hostname, options, callback);
    if (!hostname || net.isIP(hostname) || family === 6 || hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return passThrough();
    }

    const reply = (addresses) => {
      if (options.all) callback(null, addresses.map((address) => ({ address, family: 4 })));
      else callback(null, addresses[0], 4);
    };

    const hit = cache.get(hostname);
    if (hit && hit.expires > Date.now()) return process.nextTick(reply, hit.addresses);

    resolver.resolve4(hostname, { ttl: true }, (err, records) => {
      if (err || !records || !records.length) return passThrough();
      const ttl = Math.max(MIN_TTL_S, Math.min(...records.map((r) => r.ttl || 0)));
      const addresses = records.map((r) => r.address);
      cache.set(hostname, { addresses, expires: Date.now() + ttl * 1000 });
      reply(addresses);
    });
  }
  fastLookup.__fastDns = true;
  dns.lookup = fastLookup;
  console.log('[dns] Using public DNS (8.8.8.8 / 1.1.1.1) for outbound lookups — set PUBLIC_DNS=off to disable');
}

install();

module.exports = { install };
