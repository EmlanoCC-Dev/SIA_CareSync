/**
 * Database Configuration
 * ──────────────────────
 * Data Access Layer — MongoDB connection via Mongoose.
 */

const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('✅  MongoDB connected:', mongoose.connection.name);
  } catch (err) {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
