// Verbatim port of reference-python/field_configs.py.
// Field types map to TS as: currency → number, percentage → number,
// int → number, string → string.

export type FieldType = 'string' | 'currency' | 'percentage' | 'int';

export interface FieldConfig {
  name: string;
  prompt: string;
  fieldType: FieldType;
  required: boolean;
  minValue?: number;
  maxValue?: number;
  description: string;
  examples: string[];
  commonFormats: string[];
}

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
  dealName: {
    name: 'dealName',
    prompt: "What's the name of this deal?",
    fieldType: 'string',
    required: true,
    description: 'A descriptive name for the real estate deal',
    examples: ['Downtown Office Complex', 'Main Street Shopping Center', 'Sunrise Plaza'],
    commonFormats: ['Simple text', 'Building name + location', 'Address-based names'],
  },
  purchasePrice: {
    name: 'purchasePrice',
    prompt: "What's the purchase price? (Enter amount in dollars)",
    fieldType: 'currency',
    required: true,
    minValue: 1,
    description: 'The total acquisition cost of the property in US dollars',
    examples: ['$5,000,000', '5M', '5.5 million', '5500000'],
    commonFormats: ['With dollar sign', 'With commas', 'Abbreviated (M, K)', 'Written out (million)'],
  },
  netOperatingIncome: {
    name: 'netOperatingIncome',
    prompt: "What's the Net Operating Income (NOI)? (Enter amount in dollars)",
    fieldType: 'currency',
    required: true,
    minValue: 1,
    description: 'Annual net operating income after operating expenses but before debt service',
    examples: ['$400,000', '400K', 'four hundred thousand', '0.4M'],
    commonFormats: ['Dollar amounts', 'Abbreviated with K/M', 'Written out numbers'],
  },
  noiGrowthRate: {
    name: 'noiGrowthRate',
    prompt: "What's the NOI growth rate? (Enter as percentage)",
    fieldType: 'percentage',
    required: true,
    minValue: 0,
    maxValue: 100,
    description: 'Expected annual growth rate of net operating income as a percentage',
    examples: ['3.5%', '3.5', 'three and a half percent', '3.5 percent annually'],
    commonFormats: ['With percent sign', 'As decimal', 'Written out', 'With time period'],
  },
  holdPeriod: {
    name: 'holdPeriod',
    prompt: "What's the hold period in years?",
    fieldType: 'int',
    required: true,
    minValue: 1,
    maxValue: 50,
    description: 'Number of years the property will be held before sale',
    examples: ['10', '10 years', '10y', 'ten years', 'a decade'],
    commonFormats: ['Just number', 'Number + years', 'Number + y', 'Written out'],
  },
  exitCapRate: {
    name: 'exitCapRate',
    prompt: "What's the exit cap rate? (Enter as percentage)",
    fieldType: 'percentage',
    required: true,
    minValue: 0,
    maxValue: 100,
    description: 'Expected capitalization rate at time of sale as a percentage',
    examples: ['6.5%', '6.5', 'six and a half percent', '650 basis points'],
    commonFormats: ['Percentage', 'Decimal', 'Basis points', 'Written out'],
  },
  city: {
    name: 'city',
    prompt: 'What city is the property located in? (Optional)',
    fieldType: 'string',
    required: false,
    description: 'The city where the property is located',
    examples: ['Los Angeles', 'NYC', 'San Francisco, CA', 'Chicago, Illinois'],
    commonFormats: ['City name only', 'City, State', 'Abbreviations', 'Full state names'],
  },
};

export const FIELD_ORDER: ReadonlyArray<keyof typeof FIELD_CONFIGS> = [
  'dealName',
  'purchasePrice',
  'netOperatingIncome',
  'noiGrowthRate',
  'holdPeriod',
  'exitCapRate',
  'city',
];

const FIELD_EMOJI: Record<string, string> = {
  dealName: '📝',
  purchasePrice: '💰',
  netOperatingIncome: '📊',
  noiGrowthRate: '📈',
  holdPeriod: '⏰',
  exitCapRate: '🎯',
  city: '🌆',
};

const titleCase = (s: string): string =>
  s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export function getFieldEmoji(fieldName: string): string {
  return FIELD_EMOJI[fieldName] ?? '📋';
}

export function getFieldDisplayName(fieldName: string): string {
  return titleCase(fieldName);
}
