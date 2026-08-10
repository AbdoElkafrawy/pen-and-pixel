// =======================================================
//                     IMPORTS
// =======================================================

// Express framework for routing and handling HTTP requests
import express from "express";
import path from "path";
import fs from "fs";

// Template engine used to render dynamic HTML pages
import ejs from "ejs";

// MongoDB ODM (Object Data Modeling)
import mongoose from "mongoose";

// HTTP client for making requests to external APIs
import axios from "axios";

// Loads environment variables from the .env file
import "dotenv/config";

// Local helper function used to calculate a post's reading time
import calculateReadingTime from "./helpers/readingTime.js";

// Middleware for handling file uploads
import multer from "multer";

const uploadDir = path.join("public", "images");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, filename);
    }
});

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
        fileSize: 5 * 1024 * 1024
    }
});


// =======================================================
//                  APPLICATION CONFIGURATION
// =======================================================

// Weather code lookup table returned by the Open-Meteo API.
// Instead of displaying numeric codes (0, 1, 2...),
// we convert them into user-friendly descriptions.
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
//                  DATABASE CONNECTION
// =======================================================

// Establish a connection with MongoDB before the server starts.
await mongoose.connect("mongodb://127.0.0.1:27017/blog");

// =======================================================
//                    MONGOOSE MODELS
// =======================================================

// Defines how every blog post will be stored in MongoDB.
const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
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
        required: true
    }
});

// Creates the model we'll use throughout the application.
const Post = mongoose.model("Post", postSchema);

function deleteImageFile(imageUrl) {
    if (!imageUrl) return;

    const imagePath = path.join("public", imageUrl.replace(/^\/+/, ""));

    fs.unlink(imagePath, (err) => {
        if (err && err.code !== "ENOENT") {
            console.error("Image delete error:", err);
        }
    });
}


// =======================================================
//                  EXPRESS CONFIGURATION
// =======================================================

const app = express();
const port = process.env.PORT || 3000;

// Serves everything inside /public as static files
app.use(express.static("public"));

// Allows Express to read form data from POST requests
app.use(express.urlencoded({ extended: true }));

// Configure EJS as the application's view engine
app.set("view engine", "ejs");



let cachedWeather = null;
let weatherLastUpdated = 0;
const WEATHER_CACHE_DURATION = 60 * 60 * 1000;
// =======================================================
//                        ROUTES
// =======================================================


/* ======================================================
                    HOME PAGE
====================================================== */

app.get("/", async (req, res) => {
    
    try {

        // -----------------------------------------------
        // Fetch blog posts
        // -----------------------------------------------
        const search=req.query.search;

        let posts;

        if(search){
             posts = await Post.find({
    $or: [
        {
            title: {
                $regex: search,
                $options: "i"
            }
        },
        {
            content: {
                $regex: search,
                $options: "i"
            }
        }
    ]
}).sort({ createdAt: -1 });
        } else{
            console.log("showing all posts");
            posts = await Post.find().sort({ createdAt: -1 });
        }

         const postsWithReadingTime = posts.map(post => {
            const createdAtDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);

            return {
                ...post.toObject(),
                id: post._id.toString(),
                readingTime: calculateReadingTime(post.content),
                createdAt: createdAtDate,
                createdAtDisplay: createdAtDate.toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                })
            };
        });

        // Optional homepage widgets.
        // If an external API fails, the page should still load.
        let weather = cachedWeather ;
        let quote = null;


        // -----------------------------------------------
        // Weather Widget
        // -----------------------------------------------

        const cacheIsValid =
                    cachedWeather &&
                    Date.now() - weatherLastUpdated < WEATHER_CACHE_DURATION;

            if (!cacheIsValid) {

        try {

            const locationResponse = await axios.get(
                "https://ipapi.co/json/"
            );

            const location = locationResponse.data;

            const weatherResponse = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`
            );

            const weatherData = weatherResponse.data;

            weather = {
                city: location.city,
                temperature: Math.round(weatherData.current.temperature_2m),
                feelsLike: Math.round(weatherData.current.apparent_temperature),
                description:
                    weatherCodes[weatherData.current.weather_code] ?? "Unknown",
                updatedAt: weatherData.current.time
            };


            cachedWeather = weather;
            weatherLastUpdated = Date.now();

        } catch (error) {

            console.error("Weather API Error:", error.message);
            console.error("Failed URL:", error.config?.url);

        }

    }
        // -----------------------------------------------
        // Quote of the Day
        // -----------------------------------------------

        try {

            const quoteResponse = await axios.get(
                "https://api.api-ninjas.com/v1/quotes",
                {
                    headers: {
                        "X-Api-Key": process.env.API_NINJAS_KEY
                    }
                }
            );

            quote = {
                text: quoteResponse.data[0].quote,
                author: quoteResponse.data[0].author,
                category: quoteResponse.data[0].category
            };

        } catch (error) {

            console.error("Quote API Error:", error.message);

        }


        // -----------------------------------------------
        // Render Homepage
        // -----------------------------------------------

        res.render("home", {
            posts: postsWithReadingTime,
            weather,
            quote,
            search
        });

    } catch (error) {

        console.error("Homepage Error:", error);
        res.status(500).send("Error loading homepage");

    }
});


/* ======================================================
                  CREATE NEW POST
====================================================== */

// Display the form
app.get("/new", (req, res) => {

    res.render("new");

});


// Save the new post
app.post("/new", upload.single("image"), async (req, res) => {
    console.log(req.file);
    try {

        const { title, content } = req.body;
        const image = req.file ? `/images/${req.file.filename}` : undefined;

        const createdAt = new Date();

        const newPost = new Post({
            title,
            content,
            ...(image && { image }),
            createdAt
        });

        await newPost.save();

        res.redirect("/");

    } catch (error) {

        console.error(error);
        res.status(500).send("Error creating post");

    }

});


/* ======================================================
                    VIEW SINGLE POST
====================================================== */

app.get("/posts/:id", async (req, res) => {

    try {

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render("post", { post });

    } catch (error) {

        console.error(error);
        res.status(500).send("Error fetching post");

    }

});


/* ======================================================
                      EDIT POST
====================================================== */

// Display edit form
app.get("/posts/:id/edit", async (req, res) => {

    try {

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render("edit", { post });

    } catch (error) {

        console.error(error);
        res.status(500).send("Error fetching post");

    }

});


// Save edited post
app.post("/posts/:id/edit", upload.single("image"), async (req, res) => {

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
            updateData.image = `/images/${req.file.filename}`;
        }

        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        res.redirect("/");

    } catch (error) {

        console.error(error);
        res.status(500).send("Error updating post");

    }

});


/* ======================================================
                     DELETE POST
====================================================== */

app.post("/posts/:id/delete", async (req, res) => {

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

        console.error(error);
        res.status(500).send("Error deleting post");

    }

});


// =======================================================
//                    START SERVER
// =======================================================

app.listen(port, () => {

    console.log(`✅ Server running on http://localhost:${port}`);
    console.log("✅ Connected to MongoDB");

});