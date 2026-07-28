// Import the Express framework — handles routing, requests, and responses
import express from 'express';

// Import EJS — the templating engine used to render dynamic HTML pages
import ejs from 'ejs';

// Import Mongoose — the MongoDB library for Node.js
import mongoose from 'mongoose';

// ============================================
// 1. CONNECT TO MONGODB
// ============================================

// Connect to MongoDB (local database named "blog")
await mongoose.connect('mongodb://127.0.0.1:27017/blog');

// Define the Post schema (structure of a post)
const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: String, required: true }
});

// Create the Post model (this is what we use to interact with the database)
const Post = mongoose.model('Post', postSchema);

// ============================================
// 2. SETUP EXPRESS
// ============================================

// Create the Express application instance
const app = express();

// Port the server will listen on
const port = 3000;

// Serve static files (CSS, client-side JS, images) from the "public" folder
app.use(express.static("public"));

// Parse incoming form data (from HTML <form> submissions) into req.body
app.use(express.urlencoded({ extended: true }));

// Tell Express to use EJS as the template engine when rendering views
app.set('view engine', 'ejs');

// ============================================
// 3. ROUTES
// ============================================

// GET "/" — Homepage route.
// Fetches all posts from the database and displays them
app.get("/", async (req, res) => {
    try {
        // Find all posts in the database, sorted by createdAt (newest first)
        const posts = await Post.find().sort({ createdAt: -1 });
        res.render("home", { posts });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching posts");
    }
});

// GET "/new" — Shows the form for creating a new post
app.get("/new", (req, res) => {
    res.render("new");
});

// POST "/new" — Handles the form submission from the "new post" page
app.post("/new", async (req, res) => {
    try {
        const { title, content } = req.body;

        // Create a timestamp
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create a new post in the database
        const newPost = new Post({
            title,
            content,
            createdAt: timestamp
        });

        await newPost.save(); // Save to MongoDB

        console.log("Post saved:", newPost);
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating post");
    }
});

// GET "/posts/:id" — Shows a single post
app.get("/posts/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render("post", { post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching post");
    }
});

// GET "/posts/:id/edit" — Shows the edit form for a post
app.get("/posts/:id/edit", async (req, res) => {
    try {
        const id = req.params.id;
        const post = await Post.findById(id);

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render("edit", { post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching post");
    }
});

// POST "/posts/:id/edit" — Handles the edit form submission
app.post("/posts/:id/edit", async (req, res) => {
    try {
        const id = req.params.id;
        const { title, content } = req.body;

        // Find the post and update it
        const updatedPost = await Post.findByIdAndUpdate(
            id,
            { title, content },
            { new: true, runValidators: true }
        );

        if (!updatedPost) {
            return res.status(404).send("Post not found");
        }

        console.log("Post updated:", updatedPost);
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating post");
    }
});

// POST "/posts/:id/delete" — Deletes a specific post
app.post("/posts/:id/delete", async (req, res) => {
    try {
        const id = req.params.id;

        // Find and delete the post
        const deletedPost = await Post.findByIdAndDelete(id);

        if (!deletedPost) {
            return res.status(404).send("Post not found");
        }

        console.log("Post deleted:", deletedPost);
        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting post");
    }
});

// ============================================
// 4. START THE SERVER
// ============================================

app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
    console.log(`✅ Connected to MongoDB`);
});