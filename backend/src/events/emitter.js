/**
 * Central Event Emitter
 * ─────────────────────
 * Event-Driven Integration Layer
 *
 * Single shared EventEmitter instance used across all modules.
 * Services EMIT events here; handlers LISTEN and react.
 * This decouples modules — e.g., the Appointment module doesn't
 * need to know about Notifications or Audit Logging.
 */

const { EventEmitter } = require('events');

const emitter = new EventEmitter();

// Increase listener limit for production (we'll have multiple handlers per event)
emitter.setMaxListeners(20);

// Track background writes so a demo reset cannot race an unfinished handler.
emitter.pending = new Set();
emitter.onAsync = (event, handler) => emitter.on(event, (...args) => {
  const job = Promise.resolve(handler(...args));
  emitter.pending.add(job);
  job.then(() => emitter.pending.delete(job), () => emitter.pending.delete(job));
  return job;
});

module.exports = emitter;
