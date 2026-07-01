const seedKnowledgeBase = async (db) => {
  try {
    const kbCol = db.collection('knowledge_base');
    
    // Create text index for search if it doesn't exist
    await kbCol.createIndex({ question: "text", keywords: "text" });

    // Check if data already exists
    const count = await kbCol.countDocuments();
    if (count > 0) {
      console.log('📚 Knowledge Base already seeded.');
      return;
    }

    console.log('🌱 Seeding initial Knowledge Base for DrivePortz CoPilot...');

    const sampleData = [
      {
        title: "Vehicle Passport",
        category: "platform",
        question: "What is Vehicle Passport?",
        keywords: ["passport", "digital identity", "history", "records"],
        answer: "The **Vehicle Passport** is a digital identity for your car. It securely stores your service history, ownership history, insurance details, and maintenance records all in one place.",
        createdAt: new Date()
      },
      {
        title: "Add Vehicle",
        category: "platform",
        question: "How do I add a vehicle?",
        keywords: ["add vehicle", "register car", "new vehicle"],
        answer: "To add a vehicle, go to your **Dashboard** and click on the **'Add Vehicle'** button. Enter your license plate, VIN, and other basic details. DrivePortz will automatically generate your vehicle's digital twin.",
        createdAt: new Date()
      },
      {
        title: "Garage Registration",
        category: "platform",
        question: "How do I register my garage?",
        keywords: ["register garage", "service center", "mechanic"],
        answer: "You can register your garage by clicking on **'Garage Portal'** in the sidebar. Fill in your business details, location, and the services you offer. Once approved, your garage will appear in the DrivePortz Marketplace.",
        createdAt: new Date()
      },
      {
        title: "Vehicle IQ",
        category: "platform",
        question: "What is Vehicle IQ?",
        keywords: ["iq", "ai doctor", "diagnosis", "health"],
        answer: "**Vehicle IQ** uses artificial intelligence to help you diagnose car issues. You can describe symptoms or upload engine sounds, and our AI Doctor will suggest potential causes before you visit a mechanic.",
        createdAt: new Date()
      }
    ];

    await kbCol.insertMany(sampleData);
    console.log('✅ Knowledge Base seeded successfully.');
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
  }
};

module.exports = { seedKnowledgeBase };
