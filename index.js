// =======================================================
//                     IMPORTS
// =======================================================

// Express framework for routing and handling HTTP requests
import express from "express";

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

    createdAt: {
        type: String,
        required: true
    }
});

// Creates the model we'll use throughout the application.
const Post = mongoose.model("Post", postSchema);


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

        const posts = await Post.find().sort({ createdAt: -1 });

        const postsWithReadingTime = posts.map(post => ({
            ...post.toObject(),
            id: post._id.toString(),
            readingTime: calculateReadingTime(post.content)
        }));


        // Optional homepage widgets.
        // If an external API fails, the page should still load.
        let weather = null;
        let quote = null;


        // -----------------------------------------------
        // Weather Widget
        // -----------------------------------------------

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

        } catch (error) {

            console.error("Weather API Error:", error.message);

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
            quote
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
app.post("/new", async (req, res) => {

    try {

        const { title, content } = req.body;

        const timestamp = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const newPost = new Post({
            title,
            content,
            createdAt: timestamp
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
app.post("/posts/:id/edit", async (req, res) => {

    try {

        const { title, content } = req.body;

        const updatedPost = await Post.findByIdAndUpdate(
            req.params.id,
            { title, content },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedPost) {
            return res.status(404).send("Post not found");
        }

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