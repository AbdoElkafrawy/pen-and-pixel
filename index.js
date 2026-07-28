// Import the Express framework — handles routing, requests, and responses
import express from 'express';

// Import EJS — the templating engine used to render dynamic HTML pages
import ejs from 'ejs';

// In-memory array acting as a temporary "database" for blog posts.
// Note: this resets every time the server restarts, since nothing is saved to disk.
let posts = [];
// Create the Express application instance
const app = express() ;

// Port the server will listen on
const port= 3000 ;
// Counter used to generate a unique id for each new post.
// Starts at 1 and increments every time a post is created.
let nextId = 1;

// 👇 Creates a new Date object with the current date and time 👇
const now = new Date();

// Serve static files (CSS, client-side JS, images) from the "public" folder
app.use(express.static("public"));

// Parse incoming form data (from HTML <form> submissions) into req.body.
// "extended: true" allows parsing of nested objects/arrays in form data.
app.use(express.urlencoded({ extended: true }));

// Tell Express to use EJS as the template engine when rendering views
app.set('view engine','ejs');

/* GET "/" — homepage route.Renders the "home" view and passes the current posts array to it,
so the template can loop through and display each post.*/
app.get("/", (req,res)=>{

    const displayPosts=posts.slice().reverse();
    res.render("home" , {posts:displayPosts});
});

// GET "/new" — shows the form for creating a new post.Just renders the "new" view; no data processing needed here.
app.get("/new",(req,res)=>{

    res.render("new");
});

// POST "/new" — handles the form submission from the "new post" page.
app.post("/new", (req, res) => {

    const { title, content } = req.body; // Destructure the submitted form fields out of req.body
    
    // 👇 CREATE A TIMESTAMP RIGHT HERE 👇
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', { //formats the date in a readable way
        year: 'numeric',  //shows full year (2026)
        month: 'long',  //shows full month name (July)
        day: 'numeric', //shows day number (28)
        hour: '2-digit', // shows hour (03)
        minute: '2-digit' // shows minutes (45)
    });                     // Result: "July 28, 2026, 03:45 PM"
    
    posts.push({                         // Add a new post object to the posts array,
        id: nextId,                      // using the current nextId as its unique identifier
        title,
        content,
        createdAt: timestamp             // 👈 Saves the formatted timestamp with the post
    });
    console.log(posts); // Debug log — see current state of all posts in the console
    nextId++;           // Increment so the next post gets a different id
    res.redirect("/");     // Redirect back to the homepage so the user sees the updated post list

});

/*the delete route, POST "/posts/:id/delete" — deletes a specific post by its id.
":id" is a route parameter, so req.params.id will hold whatever id was in the URL. */
app.post( "/posts/:id/delete", (req,res) => {
    const id = Number(req.params.id);  // req.params.id arrives as a string, so convert it to a Number to correctly match against the numeric ids stored in `posts`
    console.log(req.params.id);  // Debug log — raw string id from the URL
    console.log(id);            // Debug log — numeric id after conversion
     posts=posts.filter((post) =>{ // Rebuild the posts array, keeping only posts whose id does NOT match
        return post.id !==id;});   // the one being deleted (this is how "deletion" works on an in-memory array)
        res.redirect("/");       // Redirect back to the homepage to show the updated (post-deletion) list
     })


app.get("/posts/:id/edit", (req, res) => {

    const id= Number(req.params.id);
    const post= posts.find(post => post.id ===id);
    res.render ("edit" , {post});
});


app.post("/posts/:id/edit", (req, res) => {

    const id = Number(req.params.id);

    const post = posts.find(post => post.id === id);

    if (post) {
        post.title = req.body.title;
        post.content = req.body.content;
    }

    res.redirect("/");

});

app.get("/posts/:id", (req, res) => {

    const id = Number(req.params.id);
    const post = posts.find(post => post.id === id);
    
    if (!post) {
        return res.status(404).send("Post not found");
    }

    res.render("post", { post });

});




// Start the server and listen for incoming requests on the specified port
app.listen(port,()=>{
    console.log(`Server is running on ${port}`);
});