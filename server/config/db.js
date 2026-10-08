const dns = require('dns');
const mongoose = require('mongoose');

// Some local/router DNS servers refuse SRV lookups, which breaks mongodb+srv:// URIs
// with "querySrv ECONNREFUSED". On that failure, retry once using public resolvers.
const FALLBACK_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

function isSrvLookupError(err) {
  return /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/i.test(err?.message || '') && /_mongodb\._tcp/.test(err?.message || '');
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, { dbName: 'sevasetu' });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    if (isSrvLookupError(err)) {
      console.warn(`MongoDB SRV lookup failed (${err.message}); retrying with public DNS ${FALLBACK_DNS_SERVERS.join(', ')}`);
      dns.setServers(FALLBACK_DNS_SERVERS);
      try {
        const conn = await mongoose.connect(uri, { dbName: 'sevasetu' });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return;
      } catch (retryErr) {
        console.error('MongoDB connection error:', retryErr.message);
        process.exit(1);
      }
    }
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;

// MongoDB connection helper export
