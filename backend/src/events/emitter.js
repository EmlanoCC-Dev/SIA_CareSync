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

module.exports = emitter;
