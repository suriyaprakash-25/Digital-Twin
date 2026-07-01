/**
 * Knowledge Base Agent
 * Responsible for answering questions related to the platform based on the
 * predefined KnowledgeBase collection in MongoDB.
 */

const { getDb } = require('../db');

class KnowledgeBaseAgent {
  async handleRequest(message) {
    try {
      const db = getDb();
      const kb = db.collection('knowledge_base');

      // Simple text search for PRD-1
      // Creating an index is required for $text, which we'll handle during DB seeding
      const searchResult = await kb.find(
        { $text: { $search: message } },
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(1)
      .toArray();

      if (searchResult && searchResult.length > 0) {
        return searchResult[0].answer;
      }

      // Fallback if no matching entry is found
      return "I'm still learning about that! You can check out our Help Center or ask a different question.";
    } catch (error) {
      console.error('Error in KnowledgeBaseAgent:', error);
      return "I encountered an error while searching my knowledge base. Please try again later.";
    }
  }
}

module.exports = new KnowledgeBaseAgent();
