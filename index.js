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

// Session middleware & Password hashing utility
import session from "express-session";
import bcrypt from "bcryptjs";

// Passport.js for Google OAuth 2.0 Authentication
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

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

// Defines the MongoDB schema for registered users (Google OAuth)
const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    avatar: {
        type: String
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model("User", userSchema);

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

    category: {
        type: String,
        default: "General",
        trim: true
    },

    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },
        name: {
            type: String,
            default: "Pen & Pixel Editorial"
        },
        avatar: {
            type: String,
            default: ""
        }
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
            authorName: {
                type: String,
                default: "Anonymous"
            },
            authorAvatar: {
                type: String,
                default: ""
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

// Configure Passport Google Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || "placeholder_google_client_id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_google_client_secret",
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });
                if (!user) {
                    user = await User.create({
                        googleId: profile.id,
                        displayName: profile.displayName || "Anonymous Reader",
                        email: (profile.emails && profile.emails[0]) ? profile.emails[0].value : "",
                        avatar: (profile.photos && profile.photos[0]) ? profile.photos[0].value : "",
                        role: "user"
                    });
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Auto-Categorization Migration Helper for legacy DB documents
async function autoCategorizePosts() {
    try {
        const postsToUpdate = await Post.find({
            $or: [
                { category: { $exists: false } },
                { category: null },
                { category: "" },
                { category: "General" }
            ]
        });

        for (const post of postsToUpdate) {
            const t = post.title.toLowerCase();
            if (/quantum|ai|robotics|computing|microchip|6g|spatial|chatbot|autonomous/i.test(t)) {
                post.category = "Tech";
            } else if (/midterm|infrastructure|climate|european|pacific|mineral|housing|political|bipartisan|treaty|sovereignty|government/i.test(t)) {
                post.category = "Politics";
            } else if (/crispr|cancer|space|multiverse|webb|synthetic|fusion|neuroscientists|exoplanet|gene|vaccine/i.test(t)) {
                post.category = "Science";
            } else if (/cannes|production|sci-fi|imax|sound|cinema|film|hollywood|box office|movie/i.test(t)) {
                post.category = "Cinema";
            } else if (/blockchain|provenance|biophilic|sculpture|restoration|mural|masterpiece|art|museum/i.test(t)) {
                post.category = "Art";
            } else if (/bitcoin|crypto|layer-2|cbdc|treasury|tokenized|financial/i.test(t)) {
                post.category = "Crypto";
            } else if (/1%|wealth|workweek|housing|circular|society|economy|power/i.test(t)) {
                post.category = "Society";
            } else {
                post.category = "Tech";
            }
            await post.save();
        }
    } catch (err) {
        console.error("Auto-categorization error:", err);
    }
}

// Auto-Seed Helper: Automatically seeds the database if post count is under 20
async function autoSeedIfEmpty() {
    try {
        const count = await Post.countDocuments();
        if (count < 20) {
            console.log(`[Auto-Seed] Database currently has ${count} posts. Seeding complete dataset...`);
            const seedModule = await import("./seedData.js");
            const seedPosts = seedModule.seedPosts || [];

            for (const postData of seedPosts) {
                await Post.findOneAndUpdate(
                    { title: postData.title },
                    postData,
                    { upsert: true, new: true }
                );
            }
            console.log("[Auto-Seed] Successfully seeded all 28 articles!");
        }
    } catch (err) {
        console.error("Auto-seed error:", err);
    }
}

// Run category migration and auto-seeding on server startup
(async () => {
    await autoCategorizePosts();
    await autoSeedIfEmpty();
})();


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

// Initialize Passport.js for Google OAuth
app.use(passport.initialize());
app.use(passport.session());

// Global view variables available in all EJS templates
app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.isAdmin = req.session.isAdmin || (req.user && req.user.role === "admin") || false;
    next();
});

// Middleware: checks if user is logged in via Google OR is Admin
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated() || req.session.isAdmin) {
        return next();
    }
    res.redirect("/login");
};

// Middleware: checks if logged in user is the Author of the post OR is Admin
const ensureCanEditPost = async (req, res, next) => {
    try {
        if (req.session.isAdmin) return next();

        if (!req.isAuthenticated()) {
            return res.status(401).send("You must be logged in to modify posts.");
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).send("Post not found.");
        }

        if (post.author && post.author.id && post.author.id.toString() === req.user._id.toString()) {
            return next();
        }

        return res.status(403).send("Forbidden: You can only edit or delete your own posts.");
    } catch (err) {
        console.error("Authorization check error:", err);
        return res.status(500).send("Server error during authorization check.");
    }
};

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
        const selectedCategory = req.query.category;

        const filter = {};

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } }
            ];
        }

        if (selectedCategory && selectedCategory !== "All") {
            filter.category = { $regex: `^${selectedCategory}$`, $options: "i" };
        }

        const posts = await Post.find(filter).sort({ createdAt: -1 });

        // Get list of distinct categories from database, plus predefined defaults
        const dbCategories = await Post.distinct("category");
        const defaultCategories = ["All", "Tech", "Politics", "Science", "Cinema", "Art", "Crypto", "Society"];
        const combinedCategories = Array.from(new Set([...defaultCategories, ...dbCategories.filter(Boolean)]));

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
            search,
            currentCategory: selectedCategory || "All",
            categories: combinedCategories
        });

    } catch (error) {
        console.error("Homepage Error:", error);
        res.status(500).send("Error loading homepage");
    }
});


/* -------------------------------------------------------
   AUTHENTICATION ROUTES (Google OAuth & Admin Login / Logout)
   ------------------------------------------------------- */

// Google OAuth Trigger Route
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth Callback Route
app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
    (req, res) => {
        res.redirect("/");
    }
);

app.get("/login", (req, res) => {
    if (req.session.isAdmin || req.isAuthenticated()) {
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

app.post("/logout", (req, res, next) => {
    req.session.isAdmin = false;
    req.logout((err) => {
        if (err) console.error("Passport logout error:", err);
        req.session.destroy(() => {
            res.redirect("/");
        });
    });
});


/* -------------------------------------------------------
   ADMIN SEED ROUTE (Seeds initial posts from local data)
   ------------------------------------------------------- */

app.get("/admin/seed", requireAuth, async (req, res) => {
    try {
        let seedPosts = [];
        try {
            const seedModule = await import("./seedData.js");
            seedPosts = seedModule.seedPosts || [];
        } catch (e) {
            try {
                const seedModule2 = await import("./data/seedPosts.js");
                seedPosts = seedModule2.seedPosts || [];
            } catch (err) {
                console.log("No seed dataset file found.");
            }
        }

        for (const postData of seedPosts) {
            await Post.findOneAndUpdate(
                { title: postData.title },
                postData,
                { upsert: true, new: true }
            );
        }

        await autoCategorizePosts();

        res.redirect("/");
    } catch (error) {
        console.error("Seed Route Error:", error);
        res.status(500).send("Error seeding posts");
    }
});


/* -------------------------------------------------------
   CREATE POST ROUTES (Protected: Logged In Users & Admin)
   ------------------------------------------------------- */

app.get("/new", ensureAuthenticated, (req, res) => {
    res.render("new");
});

app.post("/new", ensureAuthenticated, upload.single("image"), async (req, res) => {
    try {
        const { title, content, category } = req.body;
        const image = req.file ? (req.file.path || `/images/${req.file.filename}`) : undefined;

        let authorInfo = {
            name: "Pen & Pixel Editorial",
            avatar: ""
        };

        if (req.user) {
            authorInfo = {
                id: req.user._id,
                name: req.user.displayName,
                avatar: req.user.avatar
            };
        } else if (req.session.isAdmin) {
            authorInfo = {
                name: "Admin",
                avatar: ""
            };
        }

        const newPost = new Post({
            title,
            content,
            category: category || "General",
            author: authorInfo,
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
   EDIT POST ROUTES (Protected: Author or Admin)
   ------------------------------------------------------- */

app.get("/posts/:id/edit", ensureCanEditPost, async (req, res) => {
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

app.post("/posts/:id/edit", ensureCanEditPost, upload.single("image"), async (req, res) => {
    try {
        const { title, content, category } = req.body;
        const existingPost = await Post.findById(req.params.id);

        if (!existingPost) {
            return res.status(404).send("Post not found");
        }

        const updateData = { title, content, ...(category && { category }) };

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
   DELETE POST ROUTE (Protected: Author or Admin)
   ------------------------------------------------------- */

app.post("/posts/:id/delete", ensureCanEditPost, async (req, res) => {
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