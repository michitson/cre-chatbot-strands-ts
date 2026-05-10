# Create workflow
app_workflow = create_workflow()

@app.route('/chat', methods=['POST'])
def chat():
    """Main chat endpoint with SQLite persistence"""
    try:
        data = request.json
        session_id = data.get('session_id', str(uuid.uuid4()))
        user_message = data.get('message', '')
        
        logger.info(f"Chat request - Session: {session_id}, Message: {user_message[:50]}...")
        
        # Get or create session from database
        chat_session = ChatSessionRepository.get_session(session_id)
        
        if chat_session:
            # Convert to ChatState
            state = ChatSessionRepository.to_chat_state(chat_session)
            logger.info(f"Retrieved existing session - Step: {state.step}")
        else:
            # Create new session
            state = ChatState()
            ChatSessionRepository.create_session(session_id)
            logger.info(f"Created new session: {session_id}")
        
        # Handle new deal request
        if 'new deal' in user_message.lower() and state.step == 'complete':
            state = ChatState()  # Reset state
            logger.info("Reset state for new deal")
        
        # Add user message to state
        state.messages.append({"role": "user", "content": user_message})
        
        # Process through workflow
        result = app_workflow.invoke(state, config={"recursion_limit": 50})
        
        # Convert result back to ChatState if it's a dict
        if isinstance(result, dict):
            result = ChatState(**result)
        
        logger.info(f"Workflow result - Step: {result.step}")
        
        # Save state to database
        ChatSessionRepository.update_session(session_id, result)
        
        # If deal is completed, save to deals table
        if result.step == 'complete' and result.deal_data and result.irr_result:
            deal_id = DealRepository.save_completed_deal(result, session_id)
            logger.info(f"Saved completed deal: {deal_id}")
        
        # Get the latest assistant message
        assistant_messages = [msg for msg in result.messages if msg['role'] == 'assistant']
        latest_response = assistant_messages[-1]['content'] if assistant_messages else "I'm ready to help!"
        
        # Parse LLM response for UI signals while preserving agentic control
        agent_response = LLMResponseParser.parse_response_for_ui_signals(latest_response, result)
        
        # Build enhanced response with UX metadata
        response_data = {
            'response': latest_response,
            'session_id': session_id,
            'deal_id': result.deal_id,
            'property_type': result.property_type,
            'step': result.step,
            'irr_result': result.irr_result,
            'collected_fields': list(result.collected_fields.keys()),
            # Enhanced UX metadata (LLM-driven)
            'ui_state': agent_response.ui_state.value if agent_response.ui_state else 'chat',
            'analysis_phase': agent_response.analysis_phase.value if agent_response.analysis_phase else None,
            'deal_mode': agent_response.deal_mode or False
        }
        
        # Add progress information if available
        if agent_response.progress:
            response_data['progress'] = {
                'current': agent_response.progress.current,
                'total': agent_response.progress.total,
                'field_name': agent_response.progress.field_name
            }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({'error': 'An error occurred processing your request'}), 500

@app.route('/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get current session state from database"""
    try:
        chat_session = ChatSessionRepository.get_session(session_id)
        if chat_session:
            state = ChatSessionRepository.to_chat_state(chat_session)
            return jsonify({
                'session_id': session_id,
                'deal_id': state.deal_id,
                'property_type': state.property_type,
                'step': state.step,
                'collected_fields': state.collected_fields,
                'irr_result': state.irr_result,
                'created_at': chat_session.created_at.isoformat(),
                'updated_at': chat_session.updated_at.isoformat()
            })
        else:
            return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        logger.error(f"Error getting session {session_id}: {e}")
        return jsonify({'error': 'Error retrieving session'}), 500

@app.route('/session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    try:
        if ChatSessionRepository.delete_session(session_id):
            logger.info(f"Deleted session: {session_id}")
            return jsonify({'message': 'Session deleted successfully'})
        else:
            return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        return jsonify({'error': 'Error deleting session'}), 500

@app.route('/deals', methods=['GET'])
def get_recent_deals():
    """Get recent completed deals"""
    try:
        limit = request.args.get('limit', 10, type=int)
        deals = DealRepository.get_recent_deals(limit)
        
        deals_data = []
        for deal in deals:
            deals_data.append({
                'deal_id': deal.deal_id,
                'deal_name': deal.deal_name,
                'property_type': deal.property_type,
                'purchase_price': deal.purchase_price,
                'irr_result': deal.irr_result,
                'city': deal.city,
                'completed_at': deal.completed_at.isoformat() if deal.completed_at else None
            })
        
        return jsonify({'deals': deals_data})
        
    except Exception as e:
        logger.error(f"Error getting deals: {e}")
        return jsonify({'error': 'Error retrieving deals'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check including database connectivity"""
    try:
        db_healthy = db_manager.health_check()
        
        return jsonify({
            'status': 'healthy' if db_healthy else 'unhealthy',
            'database': 'connected' if db_healthy else 'disconnected',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0'
        }), 200 if db_healthy else 503
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

if __name__ == '__main__':
    # Ensure directories exist
    os.makedirs('./data', exist_ok=True)
    os.makedirs('./logs', exist_ok=True)
    
    logger.info("Starting CRE Chatbot application...")
    app.run(
        debug=settings.flask_debug,
        host='0.0.0.0',
        port=5000
    )