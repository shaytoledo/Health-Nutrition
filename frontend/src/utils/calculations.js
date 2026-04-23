/**
 * utils/calculations.js — Pure helper functions for the frontend
 *
 * These are stateless utilities that do not touch the network or storage.
 * Keeping them separate makes them trivial to unit-test.
 */

/**
 * Formats a number as a compact string with a unit suffix.
 * e.g. formatMacro(150, 'g') → "150g"
 *      formatMacro(2145, 'kcal') → "2,145 kcal"
 *
 * @param {number} value
 * @param {string} unit
 * @returns {string}
 */
export function formatMacro(value, unit) {
  return `${value.toLocaleString()} ${unit}`;
}

/**
 * Returns an ISO date string for today in local time: "YYYY-MM-DD"
 * Using new Date().toISOString() gives UTC which can be off by one day at night.
 *
 * @returns {string}
 */
export function todayISO() {
  const d = new Date();
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a UTC ISO timestamp to a human-friendly time string in local time.
 * e.g. "2024-01-15T14:32:00.000Z" → "2:32 PM"
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Clamps a numeric value to [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Determines the status text and colour for a macro based on how close
 * the user is to their target.
 *
 * @param {number} consumed
 * @param {number} target
 * @returns {{ label: string, color: string }}
 */
export function getMacroStatus(consumed, target) {
  if (target <= 0) return { label: 'No target', color: '#9E9E9E' };
  const ratio = consumed / target;

  if (ratio < 0.5)  return { label: 'Low',      color: '#4A90E2' };
  if (ratio < 0.85) return { label: 'On Track',  color: '#00F5C4' };
  if (ratio < 1.0)  return { label: 'Almost',    color: '#FFD93D' };
  if (ratio < 1.15) return { label: 'Reached',   color: '#FF9F43' };
  return               { label: 'Exceeded',   color: '#FF6B6B' };
}
