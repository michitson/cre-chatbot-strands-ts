import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatStateAnnotation, type ChatState } from './state.js';
import {
  calculationNode,
  completeNode,
  dataCollectionNode,
  propertySelectionNode,
  validationNode,
} from './nodes.js';

// Port of reference-python/graph.py. Conditional edges mirror the Python
// router functions exactly so behavior is preserved.

export function createCREAgent() {
  const builder = new StateGraph(ChatStateAnnotation)
    .addNode('property_selection', propertySelectionNode)
    .addNode('data_collection', dataCollectionNode)
    .addNode('validation', validationNode)
    .addNode('calculation', calculationNode)
    .addNode('complete', completeNode);

  builder.addEdge(START, 'property_selection');

  builder.addConditionalEdges(
    'property_selection',
    (state: ChatState) =>
      state.step === 'data_collection' ? 'data_collection' : END,
    { data_collection: 'data_collection', [END]: END },
  );

  builder.addConditionalEdges(
    'data_collection',
    (state: ChatState) => {
      if (state.step === 'calculation') return 'calculation';
      if (state.step === 'validation') return 'validation';
      return END;
    },
    {
      calculation: 'calculation',
      validation: 'validation',
      [END]: END,
    },
  );

  builder.addConditionalEdges(
    'validation',
    (state: ChatState) => {
      if (state.step === 'calculation') return 'calculation';
      if (state.step === 'data_collection') return 'data_collection';
      return END;
    },
    {
      calculation: 'calculation',
      data_collection: 'data_collection',
      [END]: END,
    },
  );

  builder.addConditionalEdges(
    'calculation',
    (state: ChatState) => {
      if (state.step === 'complete') return 'complete';
      if (state.step === 'validation') return 'validation';
      return END;
    },
    {
      complete: 'complete',
      validation: 'validation',
      [END]: END,
    },
  );

  builder.addConditionalEdges(
    'complete',
    (state: ChatState) =>
      state.step === 'property_selection' ? 'property_selection' : END,
    { property_selection: 'property_selection', [END]: END },
  );

  return builder.compile();
}
