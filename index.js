// =======================================================
//                    1. IMPORTS & DEPENDENCIES
// =======================================================

// Express framework for server routing and HTTP request handling
import express from "express";
import path from "path";
import fs from "fs";

// Mongoose ODM for MongoDB data modeling and interaction
import mongoose from "mongoose";

// Axios for making server-to-server requests to external APIs
import axios from "axios";

// Dotenv for loading secrets and environment variables from .env
import "dotenv/config";

// File upload middleware (images) & Cloudinary storage engine
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Session middleware for managing user authentication state
import session from "express-session";

// Password hashing utility for secure credential verification
import bcrypt from "bcryptjs";

// Custom helper: calculates estimated reading time for post content
import calculateReadingTime from "./helpers/readingTime.js";

// Custom middleware: protects admin-only routes from unauthorized access
import requireAuth from "./middleware/requireAuth.js";


// =======================================================
//              2. APPLICATION CONFIGURATION
// =======================================================

const app = express();
const port = process.env.PORT || 3000;

// Configure EJS as the view engine
app.set("view engine", "ejs");

// Weather code lookup table returned by the Open-Meteo API
const weatherCodes = {
    0: "☀️ Clear Sky",
    1: "🌤️ Mainly Clear",
    2: "⛅ Partly Cloudy",
    3: "☁️ Overcast",
    45: "🌫️ Fog",
    61: "🌧️ Rain",
    80: "🌦️ Rain Showers",
    95: "⛈️ Thunderstorm"
};


// =======================================================
//           3. DATABASE CONNECTION & SCHEMAS
// =======================================================

// Connect to MongoDB (local fallback or cloud Atlas URI)
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/blog");

// Hash the admin password once on startup using 10 salt rounds
const ADMIN_HASH = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

// Defines the MongoDB schema for blog posts
const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },

    content: {
        type: String,
        required: true
    },

    image: {
        type: String,
        required: false
    },

    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },

    likes: {
        type: Number,
        default: 0
    },

    comments: [
        {
            text: {
                type: String,
                required: true,
                trim: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
});

// Compile the Post model
const Post = mongoose.model("Post", postSchema);


// =======================================================
//             4. FILE UPLOAD SETUP (Multer)
// =======================================================

let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "pen-and-pixel-uploads",
            allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "avif"]
        }
    });
} else {
    const uploadDir = path.join("public", "images");
    fs.mkdirSync(uploadDir, { recursive: true });

    storage = multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            cb(null, filename);
        }
    });
}

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"), false);
        }
    },
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit
    }
});

// Helper: safely deletes an associated image file (from Cloudinary or local disk)
function deleteImageFile(imageUrl) {
    if (!imageUrl) return;

    if (imageUrl.includes("cloudinary.com")) {
        try {
            const parts = imageUrl.split("/");
            const filenameWithExt = parts.pop();
            const folder = parts.pop();
            const publicId = `${folder}/${filenameWithExt.substring(0, filenameWithExt.lastIndexOf("."))}`;
            cloudinary.uploader.destroy(publicId);
        } catch (err) {
            console.error("Cloudinary image delete error:", err.message);
        }
    } else {
        const imagePath = path.join("public", imageUrl.replace(/^\/+/, ""));
        fs.unlink(imagePath, (err) => {
            if (err && err.code !== "ENOENT") {
                console.error("Image cleanup error:", err.message);
            }
        });
    }
}


// =======================================================
//                 5. EXPRESS MIDDLEWARE
// =======================================================

// Serve static assets from the public directory
app.use(express.static("public"));

// Parse URL-encoded form data and JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Global view variables available in all EJS templates
app.use((req, res, next) => {
    res.locals.isAdmin = req.session.isAdmin || false;
    next();
});

// Weather API cache map (1 hour TTL)
const weatherCache = new Map();
const WEATHER_CACHE_DURATION = 60 * 60 * 1000;


// =======================================================
//                       6. ROUTES
// =======================================================

/* -------------------------------------------------------
   HOME FEED & SEARCH ROUTE
   ------------------------------------------------------- */
app.get("/", async (req, res) => {
    try {
        const search = req.query.search;
        let posts;

        // Execute regex search if query provided, else fetch all posts
        if (search) {
            posts = await Post.find({
                $or: [
                    { title: { $regex: search, $options: "i" } },
                    { content: { $regex: search, $options: "i" } }
                ]
            }).sort({ createdAt: -1 });
        } else {
            posts = await Post.find().sort({ createdAt: -1 });
        }

        // Attach computed fields: readingTime and formatted display date
        const postsWithDetails = posts.map(post => {
            const createdAtDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);

            return {
                ...post.toObject(),
                id: post._id.toString(),
                readingTime: calculateReadingTime(post.content),
                createdAtDisplay: createdAtDate.toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                })
            };
        });

        // Detect client IP for geolocation weather widget
        const clientIp = (
            (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1")
                .split(",")[0]
                .trim()
        );

        let weather = null;
        let quote = null;

        // Weather widget fetching with caching
        const cachedWeather = weatherCache.get(clientIp);
        if (cachedWeather && Date.now() - cachedWeather.updatedAt < WEATHER_CACHE_DURATION) {
            weather = cachedWeather.weather;
        } else {
            try {
                const defaultLocationUrl = "https://ipwho.is/";
                let locationUrl = (clientIp === "127.0.0.1" || clientIp === "::1")
                    ? defaultLocationUrl
                    : `https://ipwho.is/${clientIp}`;

                let locationResponse = await axios.get(locationUrl);
                let location = locationResponse.data;

                if (!location.success) {
                    locationResponse = await axios.get(defaultLocationUrl);
                    location = locationResponse.data;
                }

                const weatherResponse = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`
                );

                const weatherData = weatherResponse.data;
                weather = {
                    city: location.city || `${location.region}, ${location.country}`,
                    temperature: Math.round(weatherData.current.temperature_2m),
                    feelsLike: Math.round(weatherData.current.apparent_temperature),
                    description: weatherCodes[weatherData.current.weather_code] ?? "Unknown",
                    updatedAt: weatherData.current.time
                };

                weatherCache.set(clientIp, { weather, updatedAt: Date.now() });
            } catch (error) {
                console.error("Weather API Error:", error.message);
            }
        }

        // Quote of the day widget fetching
        try {
            const quoteResponse = await axios.get(
                "https://api.api-ninjas.com/v1/quotes",
                { headers: { "X-Api-Key": process.env.API_NINJAS_KEY } }
            );

            if (quoteResponse.data && quoteResponse.data.length > 0) {
                quote = {
                    text: quoteResponse.data[0].quote,
                    author: quoteResponse.data[0].author,
                    category: quoteResponse.data[0].category
                };
            }
        } catch (error) {
            console.error("Quote API Error:", error.message);
        }

        res.render("home", {
            posts: postsWithDetails,
            weather,
            quote,
            search
        });

    } catch (error) {
        console.error("Homepage Error:", error);
        res.status(500).send("Error loading homepage");
    }
});


/* -------------------------------------------------------
   AUTHENTICATION ROUTES (Admin Login / Logout)
   ------------------------------------------------------- */

app.get("/login", (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect("/");
    }
    res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
    const { password } = req.body;
    const isMatch = await bcrypt.compare(password, ADMIN_HASH);

    if (isMatch) {
        req.session.isAdmin = true;
        res.redirect("/");
    } else {
        res.render("login", { error: "Incorrect password. Please try again." });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});


/* -------------------------------------------------------
   ADMIN SEED ROUTE (Adds 8 trending news posts)
   ------------------------------------------------------- */

app.get("/admin/seed", requireAuth, async (req, res) => {
    try {
        const seedPosts = [
            // Tech Industry (2 posts)
            {
                title: "Quantum Advantage Achieved: How 2026 Processors Revolutionize Computing",
                content: "The tech industry has officially crossed a monumental threshold. Next-generation quantum processors have achieved true commercial quantum advantage, solving complex molecular simulation calculations in seconds that traditional supercomputers would take thousands of years to compute. Major tech leaders and research labs are accelerating deployments in cryptography, climate modeling, and material science. As quantum cloud computing becomes accessible to developers worldwide, software engineering is entering a dramatic paradigm shift where probabilistic algorithms and quantum logic gates are becoming mainstream skills.",
                image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80",
                likes: 14,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2)
            },
            {
                title: "Autonomous AI Agents Replace Passive Chatbots Across Global Enterprises",
                content: "The era of simple conversational AI chatbots is rapidly giving way to autonomous action-oriented AI agents. Unlike traditional language models that merely suggest text responses, modern AI agents possess tool-use capabilities, allowing them to debug code, execute cloud deployments, manage supply chains, and automate complex multi-step business workflows independently. Industry analysts highlight that over 65% of Fortune 500 enterprises have integrated autonomous agentic workflows into their core engineering and operational pipelines this year.",
                image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
                likes: 22,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5)
            },

            // US Politics (2 posts)
            {
                title: "2026 US Midterms: Bipartisan AI & Tech Governance Takes Center Stage",
                content: "As political campaigns intensify across the United States for the 2026 midterm elections, technology policy and artificial intelligence regulation have emerged as primary bipartisan priorities. Lawmakers from both major parties are introducing federal frameworks aimed at curbing deepfake election content, protecting consumer data privacy, and setting safety standards for foundational AI models. Debates are focusing on balancing consumer protection with American technological competitiveness in the global economy.",
                image: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
                likes: 9,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12)
            },
            {
                title: "Federal Infrastructure Grants Drive Modern Clean Energy Grid Expansion",
                content: "State governors and federal officials across the United States have announced the allocation of billions in federal infrastructure funding dedicated to modernizing the national power grid. The initiatives prioritize integrating renewable solar and wind energy, expanding high-voltage transmission corridors, and deploying grid-scale battery storage infrastructure. Analysts note that these infrastructure investments are projected to lower consumer utility costs while strengthening grid resilience against extreme weather events.",
                image: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
                likes: 11,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18)
            },

            // Medical Advances Worldwide (2 posts)
            {
                title: "CRISPR 2.0 In-Vivo Gene Editing Receives Landmark Global Approvals",
                content: "Medical science has achieved a historic milestone as regulatory health agencies worldwide granted full approvals for advanced in-vivo CRISPR gene editing therapies. Unlike first-generation treatments that required extracting cells for external manipulation, CRISPR 2.0 therapies are administered via single targeted infusions directly into the patient's bloodstream. Early clinical results demonstrate complete genetic correction for hereditary blindness, sickle cell disease, and specific metabolic liver conditions without adverse side effects.",
                image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80",
                likes: 35,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
            },
            {
                title: "Universal Personalized Cancer mRNA Vaccines Enter Phase 3 Trials",
                content: "Oncology is undergoing a revolutionary transformation as universal personalized mRNA cancer vaccines enter Phase 3 international clinical trials. By sequencing a patient's tumor genome, medical labs produce a custom vaccine within 48 hours that trains the body's immune T-cells to identify and eliminate microscopic cancer cells. Clinical trial data indicates a dramatic reduction in relapse rates for melanoma, pancreatic, and non-small cell lung cancers, signaling a new frontier in precision medicine.",
                image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80",
                likes: 41,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30)
            },

            // Art World (2 posts)
            {
                title: "Museums Adopt Blockchain Digital Provenance for Classical Masterpieces",
                content: "Leading international art institutions, including the Louvre, the Met, and Tate Modern, have unveiled a unified digital provenance network. Utilizing decentralized cryptographic verification, art curators and collectors can now track the century-spanning ownership history, restoration logs, and authenticity records of physical paintings and sculptures. The initiative aims to combat art forgery, streamline international museum loans, and bridge traditional fine art with digital archival preservation.",
                image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
                likes: 18,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36)
            },
            {
                title: "Biophilic Living Eco-Art Installations Transform Urban Architecture",
                content: "The contemporary art world is witnessing a dramatic surge in biophilic living installations — large-scale architectural artworks that incorporate living flora, bioluminescent algae, and responsive environmental sensors into urban spaces. Exhibited across major cultural capitals, these living installations change colors and textures in response to air quality, ambient sound, and climate patterns, blurring the boundary between environmental science, urban design, and fine art.",
                image: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1200&q=80",
                likes: 27,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48)
            },

            // --- POLITICS WORLDWIDE (3 posts) ---
            {
                title: "Global Climate Summit 2026: 190 Nations Sign Historic Carbon Neutrality Treaty",
                content: "Representatives from 190 countries gathered in Geneva to ratify a landmark international climate accord. The binding treaty establishes mandatory carbon reduction targets, international carbon credit trading standards, and a $100 billion annual fund supporting green infrastructure in developing economies. Diplomatic observers hail the treaty as the most comprehensive global environmental agreement since the Paris Accord.",
                image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
                likes: 19,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1)
            },
            {
                title: "European Union Passes Comprehensive Digital Rights & AI Sovereignty Act",
                content: "The European Parliament has officially enacted the Digital Rights and AI Sovereignty Act, introducing strict regulations governing automated algorithmic decision-making, synthetic media watermarking, and cross-border cloud data storage. The legislation mandates transparent source audits for high-risk AI deployments while protecting user privacy rights across all 27 member states.",
                image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
                likes: 24,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3)
            },
            {
                title: "Pacific Rim Economic Pact Expands Trade Framework Across 14 Asian Economies",
                content: "Trade ministers across 14 Pacific Rim nations have signed an expanded multilateral trade agreement designed to eliminate digital tariffs, streamline cross-border semiconductor supply chains, and establish unified cyber-security standards. Economists predict the historic agreement will boost intra-regional trade volume by 28% over the next decade.",
                image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
                likes: 15,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6)
            },

            // --- SCIENCE (3 posts) ---
            {
                title: "Deep Space Observatory Detects Water Vapor in Habitable Exoplanet Atmosphere",
                content: "Astronomers utilizing next-generation space telescopes have detected significant atmospheric water vapor and organic carbon molecules surrounding Exoplanet K2-18b, situated 120 light-years away in its star's habitable zone. Spectral analysis indicates the presence of liquid oceans and complex clouds, providing humanity's strongest evidence to date of a potentially habitable ocean world beyond our solar system.",
                image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
                likes: 38,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4)
            },
            {
                title: "Fusion Energy Breakthrough: Reactor Maintains Net Positive Output for 48 Hours",
                content: "Physicists at the International Thermonuclear Experimental Reactor have achieved a monumental landmark in clean energy, sustaining a controlled nuclear fusion reaction with net positive energy gain continuously for 48 hours. By achieving plasma temperatures exceeding 150 million degrees Celsius, the experiment confirms the commercial viability of fusion energy as a virtually limitless, zero-carbon power source.",
                image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=1200&q=80",
                likes: 31,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8)
            },
            {
                title: "Neuroscientists Map Complete Human Brain Neural Synapse Network",
                content: "A international coalition of neuroscientists and bio-engineers has published the first complete 3D synaptic map of human brain neural pathways. Utilizing ultra-high-resolution electron microscopy and AI pattern reconstruction, the landmark dataset maps over 86 billion neurons and 100 trillion synaptic connections, unlocking revolutionary avenues for treating Alzheimer's, Parkinson's, and neurological disorders.",
                image: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=80",
                likes: 45,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10)
            },

            // --- CINEMA LATEST NEWS (3 posts) ---
            {
                title: "Cannes Film Festival Unveils Palme d'Or Winners & Future of Independent Cinema",
                content: "The 79th Cannes Film Festival concluded with visionary international directors taking home top honors. The coveted Palme d'Or was awarded to an extraordinary sci-fi allegory exploring human memory and artificial consciousness, praised by critics for its groundbreaking practical cinematography and hypnotic score. Film industry executives highlighted a major resurgence in theatrical attendance for bold independent cinema.",
                image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
                likes: 27,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7)
            },
            {
                title: "Revolutionary Virtual Production Stages Transform Hollywood Visual Effects",
                content: "Hollywood studios are inaugurating next-generation 360-degree LED virtual production stages powered by real-time photorealistic graphics engines. Allowing directors to shoot scenes across virtual desert dunes, futuristic cyber-cities, and deep underwater environments without leaving the soundstage, virtual production has dramatically lowered movie production costs while enabling unprecedented creative visual freedom.",
                image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80",
                likes: 21,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9)
            },
            {
                title: "Classic Sci-Fi Masterpiece Sequel Shatters International Box Office Records",
                content: "The highly anticipated sci-fi epic sequel has shattered global opening weekend box office records, earning over $450 million worldwide. Audiences and critics alike are praising the film's immersive 70mm IMAX presentation, groundbreaking practical animatronics, and emotionally resonant storytelling. Box office analysts note that large-format Premium Large Format (PLF) screenings drove over 70% of opening weekend ticket sales.",
                image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80",
                likes: 33,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11)
            },

            // --- FEATURED & POPULAR TOPICS (4 posts) ---
            {
                title: "Humanoid Robotics Beyond the Lab: How Bipedal Androids Are Entering Homes and Factories",
                content: "Advanced humanoid robotics has made a giant leap from experimental prototypes to real-world deployment. Powered by embodied artificial intelligence, modern bipedal androids can navigate complex physical environments, assist in automotive manufacturing, and perform intricate household chores. Robotics engineers predict that over 10 million humanoid assistants will be active worldwide by 2030, marking the dawn of a new era in human-machine collaboration.",
                image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
                likes: 42,
                createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30 mins ago
            },
            {
                title: "The Multiverse Hypothesis: Quantum Physics and the Search for Parallel Universes",
                content: "Is our universe just one among an infinite ensemble of realities? Theoretical physicists and cosmologists are exploring quantum entanglement and cosmic inflation models that suggest the existence of parallel universes. Recent quantum superposition experiments at particle accelerators have provided mathematical frameworks hinting that alternate realities may branch continuously at the quantum level, challenging fundamental assumptions about time, space, and existence.",
                image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
                likes: 56,
                createdAt: new Date(Date.now() - 1000 * 60 * 45) // 45 mins ago
            },
            {
                title: "The Resilience of Crypto: The Volatile Fall and Historic Rise of Bitcoin",
                content: "From dramatic market pullbacks to surging institutional adoption, Bitcoin has experienced one of the most remarkable financial trajectories in modern economic history. Following regulatory shifts, sovereign reserve integration, and global spot ETF inflows, decentralized digital currency has solidified its role as digital gold. Market analysts examine how technological upgrades, halving cycles, and macroeconomic hedges continue to drive the evolution of global monetary systems.",
                image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
                likes: 37,
                createdAt: new Date(Date.now() - 1000 * 60 * 90) // 1.5 hrs ago
            },
            {
                title: "Wealth Concentration & Global Power: Unpacking the 1% Who Shape the World Economy",
                content: "Global wealth data reveals an unprecedented concentration of economic influence, where the top 1% of individuals control over 45% of total global net worth. Through multinational conglomerates, sovereign wealth funds, and technology monopolies, key financial decisions impact global markets, political campaigns, and resource allocation. Socioeconomic experts analyze the systemic mechanics behind capital accumulation and the growing international call for tax reform and equitable economic policies.",
                image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
                likes: 49,
                createdAt: new Date(Date.now() - 1000 * 60 * 120) // 2 hrs ago
            }
        ];

        for (const postData of seedPosts) {
            await Post.findOneAndUpdate(
                { title: postData.title },
                postData,
                { upsert: true, new: true }
            );
        }

        res.redirect("/");
    } catch (error) {
        console.error("Seed Route Error:", error);
        res.status(500).send("Error seeding posts");
    }
});


/* -------------------------------------------------------
   CREATE POST ROUTES (Protected)
   ------------------------------------------------------- */

app.get("/new", requireAuth, (req, res) => {
    res.render("new");
});

app.post("/new", requireAuth, upload.single("image"), async (req, res) => {
    try {
        const { title, content } = req.body;
        const image = req.file ? (req.file.path || `/images/${req.file.filename}`) : undefined;

        const newPost = new Post({
            title,
            content,
            ...(image && { image }),
            createdAt: new Date()
        });

        await newPost.save();
        res.redirect("/");

    } catch (error) {
        console.error("Create Post Error:", error);
        res.status(500).send("Error creating post");
    }
});


/* -------------------------------------------------------
   VIEW SINGLE POST ROUTE
   ------------------------------------------------------- */

app.get("/posts/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        const createdAtDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);
        const postWithDetails = {
            ...post.toObject(),
            id: post._id.toString(),
            readingTime: calculateReadingTime(post.content),
            createdAtDisplay: createdAtDate.toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            })
        };

        res.render("post", { post: postWithDetails });

    } catch (error) {
        console.error("View Post Error:", error);
        res.status(500).send("Error fetching post");
    }
});


/* -------------------------------------------------------
   EDIT POST ROUTES (Protected)
   ------------------------------------------------------- */

app.get("/posts/:id/edit", requireAuth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render("edit", { post });

    } catch (error) {
        console.error("Edit View Error:", error);
        res.status(500).send("Error fetching post for edit");
    }
});

app.post("/posts/:id/edit", requireAuth, upload.single("image"), async (req, res) => {
    try {
        const { title, content } = req.body;
        const existingPost = await Post.findById(req.params.id);

        if (!existingPost) {
            return res.status(404).send("Post not found");
        }

        const updateData = { title, content };

        if (req.file) {
            if (existingPost.image) {
                deleteImageFile(existingPost.image);
            }
            updateData.image = req.file.path || `/images/${req.file.filename}`;
        }

        await Post.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.redirect("/");

    } catch (error) {
        console.error("Update Post Error:", error);
        res.status(500).send("Error updating post");
    }
});


/* -------------------------------------------------------
   DELETE POST ROUTE (Protected)
   ------------------------------------------------------- */

app.post("/posts/:id/delete", requireAuth, async (req, res) => {
    try {
        const deletedPost = await Post.findByIdAndDelete(req.params.id);

        if (!deletedPost) {
            return res.status(404).send("Post not found");
        }

        if (deletedPost.image) {
            deleteImageFile(deletedPost.image);
        }

        res.redirect("/");

    } catch (error) {
        console.error("Delete Post Error:", error);
        res.status(500).send("Error deleting post");
    }
});


/* -------------------------------------------------------
   INTERACTIVE LIKE & UNLIKE API ROUTES (AJAX / Fetch)
   ------------------------------------------------------- */

app.post("/like/:id", async (req, res) => {
    try {
        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );

        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        res.json({ likes: post.likes });

    } catch (error) {
        console.error("Like API Error:", error.message);
        res.status(500).json({ error: "Error liking post" });
    }
});

app.post("/unlike/:id", async (req, res) => {
    try {
        const currentPost = await Post.findById(req.params.id);

        if (!currentPost) {
            return res.status(404).json({ error: "Post not found" });
        }

        const newLikeCount = Math.max(0, (currentPost.likes || 1) - 1);

        const post = await Post.findByIdAndUpdate(
            req.params.id,
            { likes: newLikeCount },
            { new: true }
        );

        res.json({ likes: post.likes });

    } catch (error) {
        console.error("Unlike API Error:", error.message);
        res.status(500).json({ error: "Error unliking post" });
    }
});


/* -------------------------------------------------------
   COMMENT ROUTES (Add / Delete)
   ------------------------------------------------------- */

app.post("/posts/:id/comments", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.redirect(`/posts/${req.params.id}`);
        }

        await Post.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    comments: {
                        text: text.trim(),
                        createdAt: new Date()
                    }
                }
            }
        );

        res.redirect(`/posts/${req.params.id}#comments`);

    } catch (error) {
        console.error("Add Comment Error:", error);
        res.status(500).send("Error adding comment");
    }
});

app.post("/posts/:id/comments/:commentId/delete", requireAuth, async (req, res) => {
    try {
        await Post.findByIdAndUpdate(
            req.params.id,
            {
                $pull: {
                    comments: { _id: req.params.commentId }
                }
            }
        );

        res.redirect(`/posts/${req.params.id}#comments`);

    } catch (error) {
        console.error("Delete Comment Error:", error);
        res.status(500).send("Error deleting comment");
    }
});


// Express Error Handling Middleware (catches Multer file size / format errors gracefully)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).send("File size too large! Maximum image upload size is 15MB.");
        }
        return res.status(400).send(`File Upload Error: ${err.message}`);
    } else if (err) {
        return res.status(400).send(err.message || "An unexpected error occurred.");
    }
    next();
});


// =======================================================
//                  7. START SERVER
// =======================================================

app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log("✅ Connected to MongoDB");
});