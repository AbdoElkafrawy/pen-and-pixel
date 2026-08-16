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

// Defines MongoDB schema for User Notifications
const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["submitted", "approved", "rejected", "info"],
        default: "info"
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: false
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model("Notification", notificationSchema);

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

    isApproved: {
        type: Boolean,
        default: false
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

// Approve legacy database posts helper
async function approveLegacyPosts() {
    try {
        await Post.updateMany(
            { isApproved: { $exists: false } },
            { $set: { isApproved: true } }
        );
    } catch (err) {
        console.error("Approve legacy posts error:", err);
    }
}

// Run category migration, auto-seeding, image path cleanup, and legacy post approval on server startup
(async () => {
    await autoCategorizePosts();
    await autoSeedIfEmpty();
    await fixImagePaths();
    await approveLegacyPosts();
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

// Helper: returns clean image URL for Cloudinary HTTPS or local /images/ path
function getImageUrl(file) {
    if (!file) return undefined;
    if (file.path && (file.path.startsWith("http://") || file.path.startsWith("https://"))) {
        return file.path;
    }
    return `/images/${file.filename}`;
}

// Migration helper: fix any local image paths in MongoDB that had 'public/' or 'public\' prefix
async function fixImagePaths() {
    try {
        const postsWithBadPaths = await Post.find({
            image: { $regex: "^public[/\\\\]", $options: "i" }
        });

        for (const post of postsWithBadPaths) {
            let cleanPath = post.image.replace(/^public[/\\\\]/i, "images/").replace(/\\/g, "/");
            if (!cleanPath.startsWith("/")) {
                cleanPath = "/" + cleanPath;
            }
            post.image = cleanPath;
            await post.save();
        }
    } catch (err) {
        console.error("Image path migration error:", err);
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

// Session middleware configuration (2 hours TTL, rolling refresh on activity)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Refreshes 2-hour session expiration timer on user activity
    cookie: {
        maxAge: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
    }
}));

// Initialize Passport.js for Google OAuth
app.use(passport.initialize());
app.use(passport.session());

// Global view variables available in all EJS templates
app.use(async (req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.isAdmin = req.session.isAdmin || (req.user && req.user.role === "admin") || false;
    res.locals.unreadNotificationCount = 0;
    res.locals.userNotifications = [];
    res.locals.pendingApprovalCount = 0;

    if (req.user) {
        try {
            const rawNotifications = await Notification.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .limit(10);

            res.locals.userNotifications = rawNotifications.map(n => {
                const dateObj = n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt);
                return {
                    ...n.toObject(),
                    id: n._id.toString(),
                    createdAtDisplay: dateObj.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                };
            });

            res.locals.unreadNotificationCount = await Notification.countDocuments({
                userId: req.user._id,
                isRead: false
            });
        } catch (e) {
            console.error("Notifications middleware error:", e);
        }
    }

    if (res.locals.isAdmin) {
        try {
            res.locals.pendingApprovalCount = await Post.countDocuments({ isApproved: false });
        } catch (e) {
            console.error("Pending approvals count error:", e);
        }
    }

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

// Helper: Fail-safe geolocation & weather fetcher for local and production deployment (Render)
async function fetchWeatherForClient(clientIp) {
    const cached = weatherCache.get(clientIp);
    if (cached && Date.now() - cached.updatedAt < WEATHER_CACHE_DURATION) {
        return cached.weather;
    }

    let latitude = 30.0444;
    let longitude = 31.2357;
    let cityName = "Cairo, Egypt";

    const customHeaders = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PenAndPixelBlog/1.0" };

    try {
        const isPrivateIp = !clientIp || clientIp === "127.0.0.1" || clientIp === "::1" || /^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(clientIp);
        const geoUrl = isPrivateIp ? "https://ipwho.is/" : `https://ipwho.is/${clientIp}`;

        const geoRes = await axios.get(geoUrl, { headers: customHeaders, timeout: 4000 });
        if (geoRes.data && geoRes.data.success) {
            latitude = geoRes.data.latitude;
            longitude = geoRes.data.longitude;
            cityName = geoRes.data.city ? `${geoRes.data.city}, ${geoRes.data.country_code || geoRes.data.country}` : (geoRes.data.country || "Cairo");
        } else {
            const fallbackGeoRes = await axios.get("https://ipwho.is/", { headers: customHeaders, timeout: 4000 });
            if (fallbackGeoRes.data && fallbackGeoRes.data.success) {
                latitude = fallbackGeoRes.data.latitude;
                longitude = fallbackGeoRes.data.longitude;
                cityName = fallbackGeoRes.data.city ? `${fallbackGeoRes.data.city}, ${fallbackGeoRes.data.country_code || fallbackGeoRes.data.country}` : "Cairo";
            }
        }
    } catch (geoErr) {
        console.log("IP Geolocation Notice (using fallback coordinates):", geoErr.message);
    }

    try {
        const weatherRes = await axios.get(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`,
            { timeout: 4000 }
        );

        const current = weatherRes.data.current;
        const weather = {
            city: cityName,
            temperature: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature),
            description: weatherCodes[current.weather_code] ?? "Clear Sky",
            updatedAt: current.time
        };

        weatherCache.set(clientIp, { weather, updatedAt: Date.now() });
        return weather;
    } catch (weatherErr) {
        console.error("Open-Meteo Weather API Error:", weatherErr.message);
        return {
            city: cityName || "Cairo, Egypt",
            temperature: 28,
            feelsLike: 30,
            description: "☀️ Clear Sky",
            updatedAt: new Date().toISOString()
        };
    }
}


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
        const selectedAuthor = req.query.author;

        const filter = { isApproved: true };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } }
            ];
        }

        if (selectedCategory && selectedCategory !== "All") {
            filter.category = { $regex: `^${selectedCategory}$`, $options: "i" };
        }

        if (selectedAuthor) {
            filter["author.name"] = { $regex: `^${selectedAuthor}$`, $options: "i" };
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

        const weather = await fetchWeatherForClient(clientIp);
        let quote = null;

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
            currentAuthor: selectedAuthor || null,
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

// Google OAuth Trigger Route (checks environment credentials before authenticating)
app.get("/auth/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.startsWith("placeholder")) {
        return res.render("login", { error: "Google OAuth is not configured on this server yet. Please add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET to environment variables." });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

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
        const image = getImageUrl(req.file);

        // Server-side duplicate post protection (catches rapid double-clicks)
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
        const duplicateCheck = await Post.findOne({
            title,
            content,
            createdAt: { $gte: tenSecondsAgo }
        });

        if (duplicateCheck) {
            console.log("[Duplicate Post Guard] Rapid double-submission caught and ignored.");
            return res.redirect("/my-posts");
        }

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

        // Admin posts are auto-approved; User posts require admin approval
        const isApprovedByRole = req.session.isAdmin ? true : false;

        const newPost = new Post({
            title,
            content,
            category: category || "General",
            author: authorInfo,
            isApproved: isApprovedByRole,
            ...(image && { image }),
            createdAt: new Date()
        });

        await newPost.save();

        if (isApprovedByRole) {
            res.redirect("/my-posts");
        } else {
            if (req.user) {
                await Notification.create({
                    userId: req.user._id,
                    message: `⏳ Your article "${newPost.title}" has been submitted and is awaiting admin approval.`,
                    type: "submitted",
                    postId: newPost._id
                });
            }
            res.redirect("/my-posts?submitted=true");
        }

    } catch (error) {
        console.error("Create Post Error:", error);
        res.status(500).send("Error creating post");
    }
});


/* -------------------------------------------------------
   MY POSTS DASHBOARD ROUTE (Protected)
   ------------------------------------------------------- */

app.get("/my-posts", ensureAuthenticated, async (req, res) => {
    try {
        let filter = {};

        if (req.user) {
            filter = { "author.id": req.user._id };
        } else if (req.session.isAdmin) {
            filter = {
                $or: [
                    { "author.id": { $exists: false } },
                    { "author.name": "Admin" },
                    { "author.name": "Pen & Pixel Editorial" }
                ]
            };
        }

        const myPosts = await Post.find(filter).sort({ createdAt: -1 });

        const formattedPosts = myPosts.map(post => {
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

        // Admin view: fetch all unapproved pending posts across the platform
        let pendingPosts = [];
        if (req.session.isAdmin) {
            const rawPending = await Post.find({ isApproved: false }).sort({ createdAt: -1 });
            pendingPosts = rawPending.map(post => {
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
        }

        res.render("my-posts", {
            posts: formattedPosts,
            pendingPosts,
            submitted: req.query.submitted === "true"
        });

    } catch (error) {
        console.error("My Posts Route Error:", error);
        res.status(500).send("Error loading your posts dashboard.");
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

        // Unapproved posts are only viewable by Admin or the original Author
        const isAdmin = req.session.isAdmin || (req.user && req.user.role === "admin");
        const isAuthor = req.user && post.author && post.author.id && (post.author.id.toString() === req.user._id.toString());

        if (!post.isApproved && !isAdmin && !isAuthor) {
            return res.status(403).send("Forbidden: This article is pending admin approval.");
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
            updateData.image = getImageUrl(req.file);
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
   ADMIN PENDING APPROVALS QUEUE ROUTE (Protected: Admin Only)
   ------------------------------------------------------- */

app.get("/admin/approvals", requireAuth, async (req, res) => {
    try {
        const rawPending = await Post.find({ isApproved: false }).sort({ createdAt: -1 });
        const formattedPending = rawPending.map(post => {
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

        res.render("admin-approvals", { posts: formattedPending });

    } catch (error) {
        console.error("Admin Approvals Route Error:", error);
        res.status(500).send("Error loading admin approvals queue.");
    }
});


/* -------------------------------------------------------
   APPROVE POST ROUTE (Protected: Admin Only)
   ------------------------------------------------------- */

app.post("/posts/:id/approve", requireAuth, async (req, res) => {
    try {
        const approvedPost = await Post.findByIdAndUpdate(
            req.params.id,
            { isApproved: true },
            { new: true }
        );

        if (!approvedPost) {
            return res.status(404).send("Post not found");
        }

        // Notify user that their article has been approved by admin
        if (approvedPost.author && approvedPost.author.id) {
            await Notification.create({
                userId: approvedPost.author.id,
                message: `🎉 Great news! Your article "${approvedPost.title}" has been approved by the admin and is now live on Pen & Pixel!`,
                type: "approved",
                postId: approvedPost._id
            });
        }

        console.log(`[Post Approved] Article "${approvedPost.title}" was approved by Admin.`);
        res.redirect("/admin/approvals");

    } catch (error) {
        console.error("Approve Post Error:", error);
        res.status(500).send("Error approving post");
    }
});


/* -------------------------------------------------------
   NOTIFICATIONS API ROUTE (AJAX)
   ------------------------------------------------------- */

app.post("/notifications/mark-read", async (req, res) => {
    try {
        if (req.user) {
            await Notification.updateMany(
                { userId: req.user._id, isRead: false },
                { $set: { isRead: true } }
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Mark notifications read error:", err);
        res.status(500).json({ error: "Failed to mark notifications read" });
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