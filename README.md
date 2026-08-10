# Pen & Pixel

Pen & Pixel is a full-stack blog application built with Node.js, Express.js, EJS, and MongoDB.

The project started as part of Angela Yu's Full-Stack Web Development Bootcamp and was expanded with additional features and a Git feature-branch workflow.

## Features

- Create, view, edit, and delete blog posts
- Search posts by title or content
- Upload and replace post images
- Reading-time calculation
- Weather widget based on visitor location
- Quote of the Day
- MongoDB persistence
- Graceful handling of external API failures

## Tech Stack

- Node.js
- Express.js
- EJS
- MongoDB / Mongoose
- Axios
- Multer
- HTML / CSS
- Git / GitHub

## Project Structure

```text
pen-and-pixel/
├── helpers/
│   └── readingTime.js
├── public/
│   ├── css/
│   │   └── style.css
│   ├── images/
│   └── js/
│       └── script.js
├── views/
│   ├── home.ejs
│   ├── new.ejs
│   ├── edit.ejs
│   └── post.ejs
├── index.js
├── package.json
└── README.md

Setup

Clone the repository:

git clone https://github.com/AbdoElkafrawy/pen-and-pixel.git
cd pen-and-pixel

Install dependencies:

npm install

Create a .env file in the project root:

MONGODB_URI=your_mongodb_connection_string
API_NINJAS_KEY=your_api_key
PORT=3000

Start the application:

npm start

Then open:

http://localhost:3000
Git Workflow

Features are developed on separate branches and merged into main after testing.

Example:

git switch -c feature/new-feature
git add .
git commit -m "Add new feature"
git push -u origin feature/new-feature
Current Status

The core blogging features are complete. The next step is preparing the application for production deployment, including moving uploaded images to persistent cloud storage.

Future Improvements
User authentication and authorization
Categories and tags
Pagination
Comments and likes
Admin dashboard
REST API
Production image storage
React frontend