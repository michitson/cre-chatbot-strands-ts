import { z } from 'zod';
import {
  FIELD_CONFIGS,
  FIELD_ORDER,
  getFieldDisplayName,
  getFieldEmoji,
} from '../utils/field-configs.js';
import type { DealData } from '../langraph/state.js';

// Port of models/deal_data.py DealData with the same validation constraints.
// camelCase'd; min/max ranges preserved verbatim.
const DealDataSchema = z.object({
  dealName: z.string().min(1),
  purchasePrice: z.number().int().positive(),
  netOperatingIncome: z.number().int().positive(),
  noiGrowthRate: z.number().min(0).max(100),
  holdPeriod: z.number().int().min(1).max(50),
  exitCapRate: z.number().positive().max(100),
  city: z.string().optional(),
});

export function getMissingRequiredFields(
  collected: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const fieldName of FIELD_ORDER) {
    const cfg = FIELD_CONFIGS[fieldName];
    if (cfg.required && !(fieldName in collected)) {
      missing.push(fieldName);
    }
  }
  return missing;
}

export function getNextFieldToCollect(
  collected: Record<string, unknown>,
): string | null {
  const missingRequired = getMissingRequiredFields(collected);
  if (missingRequired.length > 0) return missingRequired[0];

  for (const fieldName of FIELD_ORDER) {
    const cfg = FIELD_CONFIGS[fieldName];
    if (!cfg.required && !(fieldName in collected)) {
      return fieldName;
    }
  }
  return null;
}

export function getFieldPrompt(fieldName: string): string {
  const cfg = FIELD_CONFIGS[fieldName];
  if (!cfg) {
    const display = getFieldDisplayName(fieldName);
    return `📝 **${display}**\n\nPlease provide the ${display.toLowerCase()}:`;
  }
  const display = getFieldDisplayName(fieldName);
  const emoji = getFieldEmoji(fieldName);
  let out = `${emoji} **${display}**\n\n${cfg.prompt}`;
  if (cfg.examples.length > 0) {
    out += `\n\n*Examples: ${cfg.examples.join(', ')}*`;
  }
  return out;
}

export type ValidationResult =
  | { valid: true; dealData: DealData }
  | { valid: false; error: string };

export function validateAllCollectedFields(
  collected: Record<string, unknown>,
): ValidationResult {
  const missing = getMissingRequiredFields(collected);
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }
  const parsed = DealDataSchema.safeParse(collected);
  if (parsed.success) {
    return { valid: true, dealData: parsed.data };
  }
  const first = parsed.error.issues[0];
  const fieldName = first.path.join('.');
  return {
    valid: false,
    error: `Validation error for ${fieldName}: ${first.message}`,
  };
}
