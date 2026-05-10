import { FIELD_CONFIGS } from '../utils/field-configs.js';

export type ParseResult =
  | { success: true; value: string | number }
  | { success: false; error: string };

const STRIP_NON_NUMERIC = /[\s$,_]/g;

// Stub parser for Phase 1–3. Handles the literal numeric/abbreviated forms in
// FIELD_CONFIGS examples ("$5M", "5,000,000", "3.5%", "10 years", "10y").
// Written-out forms ("five million", "ten years", "a decade") are out of
// scope here and hand off to the LLM-powered parser in Phase 4.
export function parseFieldValue(
  fieldName: string,
  userInput: string,
): ParseResult {
  const cfg = FIELD_CONFIGS[fieldName];
  if (!cfg) return { success: false, error: `Unknown field: ${fieldName}` };

  const raw = userInput.trim();
  if (raw === '') return { success: false, error: 'Empty input' };

  switch (cfg.fieldType) {
    case 'string':
      return { success: true, value: raw };

    case 'currency':
      return parseCurrency(raw);

    case 'percentage':
      return parsePercentage(raw);

    case 'int':
      return parseInteger(raw);
  }
}

function parseCurrency(raw: string): ParseResult {
  // Match an optional $, a number (with optional decimals/commas),
  // and an optional K/M suffix.
  const match = raw.match(/^\$?\s*([\d,_.]+)\s*([kKmM])?\s*$/);
  if (!match) {
    return { success: false, error: `Could not parse currency from "${raw}"` };
  }
  const numeric = Number(match[1].replace(STRIP_NON_NUMERIC, ''));
  if (!Number.isFinite(numeric)) {
    return { success: false, error: `Invalid currency number in "${raw}"` };
  }
  const scale =
    match[2]?.toLowerCase() === 'm' ? 1_000_000
    : match[2]?.toLowerCase() === 'k' ? 1_000
    : 1;
  const value = Math.round(numeric * scale);
  if (value <= 0) {
    return { success: false, error: 'Currency must be positive' };
  }
  return { success: true, value };
}

function parsePercentage(raw: string): ParseResult {
  const match = raw.match(/^([\d.]+)\s*%?\s*$/);
  if (!match) {
    return { success: false, error: `Could not parse percentage from "${raw}"` };
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return { success: false, error: `Invalid percentage in "${raw}"` };
  }
  if (value < 0 || value > 100) {
    return { success: false, error: `Percentage out of range (0–100): ${value}` };
  }
  return { success: true, value };
}

function parseInteger(raw: string): ParseResult {
  // Strip 'years' / 'year' / 'y' suffix.
  const cleaned = raw.replace(/\s*(years?|y)\s*$/i, '').trim();
  const match = cleaned.match(/^(\d+)$/);
  if (!match) {
    return { success: false, error: `Could not parse integer from "${raw}"` };
  }
  return { success: true, value: parseInt(match[1], 10) };
}
