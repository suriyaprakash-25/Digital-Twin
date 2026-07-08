/**
 * Platform Agent
 * Handles questions specifically about how to use the Driveportz platform features.
 * In PRD-1, this delegates entirely to the KnowledgeBaseAgent.
 */

const knowledgeBaseAgent = require('./knowledgeBaseAgent');

class PlatformAgent {
  async handleRequest(message) {
    // For PRD-1, the Platform Agent simply queries the Knowledge Base.
    // In future iterations, this agent will interact with specific feature APIs.
    
    return await knowledgeBaseAgent.handleRequest(message);
  }
}

module.exports = new PlatformAgent();
