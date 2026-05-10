import { Annotation } from '@langchain/langgraph';

export type Role = 'user' | 'assistant';
export interface Message {
  role: Role;
  content: string;
}

export type WorkflowStep =
  | 'property_selection'
  | 'data_collection'
  | 'validation'
  | 'calculation'
  | 'complete';

export type PropertyType = 'office' | 'shopping_center';

export interface DealData {
  dealName: string;
  purchasePrice: number;
  netOperatingIncome: number;
  noiGrowthRate: number;
  holdPeriod: number;
  exitCapRate: number;
  city?: string;
}

export interface IrrResult {
  irrPercentage: number;
  totalReturnPercentage: number;
  annualCashFlowYear1: number;
  exitValue: number;
}

export const ChatStateAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),

  messages: Annotation<Message[], Message | Message[]>({
    reducer: (left, right) =>
      Array.isArray(right) ? left.concat(right) : left.concat([right]),
    default: () => [],
  }),

  step: Annotation<WorkflowStep>({
    reducer: (_left, right) => right,
    default: () => 'property_selection',
  }),

  propertyType: Annotation<PropertyType | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  dealId: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  collectedFields: Annotation<Record<string, unknown>>({
    reducer: (_left, right) => right,
    default: () => ({}),
  }),

  dealData: Annotation<DealData | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),

  irrResult: Annotation<IrrResult | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
});

export type ChatState = typeof ChatStateAnnotation.State;
export type ChatStateUpdate = typeof ChatStateAnnotation.Update;
