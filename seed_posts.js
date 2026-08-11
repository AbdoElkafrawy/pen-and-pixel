import mongoose from "mongoose";

const MONGODB_URI = "mongodb://elkafrawy88_db_user:LTz0IrKpv3kN8eLP@ac-e5o119i-shard-00-00.uyxjeg6.mongodb.net:27017,ac-e5o119i-shard-00-01.uyxjeg6.mongodb.net:27017,ac-e5o119i-shard-00-02.uyxjeg6.mongodb.net:27017/blog?ssl=true&replicaSet=atlas-13c5p1-shard-0&authSource=admin&retryWrites=true&w=majority";

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String },
    createdAt: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    comments: [{ text: String, createdAt: { type: Date, default: Date.now } }]
});

const Post = mongoose.model("Post", postSchema);

const newPosts = [
    // --- TECH INDUSTRY ---
    {
        title: "Quantum Advantage Achieved: How 2026 Processors Revolutionize Computing",
        content: "The tech industry has officially crossed a monumental threshold. Next-generation quantum processors have achieved true commercial quantum advantage, solving complex molecular simulation calculations in seconds that traditional supercomputers would take thousands of years to compute. Major tech leaders and research labs are accelerating deployments in cryptography, climate modeling, and material science. As quantum cloud computing becomes accessible to developers worldwide, software engineering is entering a dramatic paradigm shift where probabilistic algorithms and quantum logic gates are becoming mainstream skills.",
        likes: 14,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
    },
    {
        title: "Autonomous AI Agents Replace Passive Chatbots Across Global Enterprises",
        content: "The era of simple conversational AI chatbots is rapidly giving way to autonomous action-oriented AI agents. Unlike traditional language models that merely suggest text responses, modern AI agents possess tool-use capabilities, allowing them to debug code, execute cloud deployments, manage supply chains, and automate complex multi-step business workflows independently. Industry analysts highlight that over 65% of Fortune 500 enterprises have integrated autonomous agentic workflows into their core engineering and operational pipelines this year.",
        likes: 22,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5) // 5 hours ago
    },

    // --- USA POLITICS ---
    {
        title: "2026 US Election Trail: Bipartisan AI & Tech Governance Takes Center Stage",
        content: "As political campaigns intensify across the United States for the 2026 midterm elections, technology policy and artificial intelligence regulation have emerged as primary bipartisan priorities. Lawmakers from both major parties are introducing federal frameworks aimed at curbing deepfake election content, protecting consumer data privacy, and setting safety standards for foundational AI models. Debates are focusing on balancing consumer protection with American technological competitiveness in the global economy.",
        likes: 9,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12) // 12 hours ago
    },
    {
        title: "Federal Infrastructure Grant Allocation Drives Clean Energy Grid Expansion",
        content: "State governors and federal officials across the United States have announced the allocation of billions in federal infrastructure funding dedicated to modernizing the national power grid. The initiatives prioritize integrating renewable solar and wind energy, expanding high-voltage transmission corridors, and deploying grid-scale battery storage infrastructure. Analysts note that these infrastructure investments are projected to lower consumer utility costs while strengthening grid resilience against extreme weather events.",
        likes: 11,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18) // 18 hours ago
    },

    // --- MEDICAL ADVANCES ---
    {
        title: "CRISPR 2.0 In-Vivo Gene Editing Receives Landmark Global Approvals",
        content: "Medical science has achieved a historic milestone as regulatory health agencies worldwide granted full approvals for advanced in-vivo CRISPR gene editing therapies. Unlike first-generation treatments that required extracting cells for external manipulation, CRISPR 2.0 therapies are administered via single targeted infusions directly into the patient's bloodstream. Early clinical results demonstrate complete genetic correction for hereditary blindness, sickle cell disease, and specific metabolic liver conditions without adverse side effects.",
        likes: 35,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
    },
    {
        title: "Universal Personalized Cancer mRNA Vaccines Enter Phase 3 Clinical Trials",
        content: "Oncology is undergoing a revolutionary transformation as universal personalized mRNA cancer vaccines enter Phase 3 international clinical trials. By sequencing a patient's tumor genome, medical labs produce a custom vaccine within 48 hours that trains the body's immune T-cells to identify and eliminate microscopic cancer cells. Clinical trial data indicates a dramatic reduction in relapse rates for melanoma, pancreatic, and non-small cell lung cancers, signaling a new frontier in precision medicine.",
        likes: 41,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30) // 1.2 days ago
    },

    // --- ART WORLD ---
    {
        title: "Museums Adopt Blockchain Digital Provenance for Classical Masterpieces",
        content: "Leading international art institutions, including the Louvre, the Met, and Tate Modern, have unveiled a unified digital provenance network. Utilizing decentralized cryptographic verification, art curators and collectors can now track the century-spanning ownership history, restoration logs, and authenticity records of physical paintings and sculptures. The initiative aims to combat art forgery, streamline international museum loans, and bridge traditional fine art with digital archival preservation.",
        likes: 18,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36) // 1.5 days ago
    },
    {
        title: "Biophilic Eco-Art Installations Transforming Modern Urban Architecture",
        content: "The contemporary art world is witnessing a dramatic surge in biophilic living installations — large-scale architectural artworks that incorporate living flora, bioluminescent algae, and responsive environmental sensors into urban spaces. Exhibited across major cultural capitals, these living installations change colors and textures in response to air quality, ambient sound, and climate patterns, blurring the boundary between environmental science, urban design, and fine art.",
        likes: 27,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48) // 2 days ago
    }
];

async function seed() {
    try {
        console.log("Connecting to MongoDB Atlas...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB Atlas!");

        const created = await Post.insertMany(newPosts);
        console.log(`✅ Successfully added ${created.length} new posts to cloud database!`);

        await mongoose.disconnect();
        console.log("Disconnected successfully.");
    } catch (error) {
        console.error("Seeding Error:", error);
    }
}

seed();
