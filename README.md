# 🖋️ Pen & Pixel

A modern, feature-rich full-stack blogging platform built with **Node.js**, **Express.js**, **MongoDB**, **Mongoose**, and **EJS**.

Pen & Pixel enables authors to publish and manage blog posts with cover images while providing readers with interactive capabilities like **instant post likes**, **comments**, **search**, **estimated reading time**, **live weather forecasts**, and **inspirational daily quotes**.

---

## ✨ Features Breakdown

### 📝 Blog Post Management (CRUD)
- **Create**: Add new posts with titles, rich content, and cover image uploads.
- **Read**: View the latest posts feed sorted chronologically, or read individual post pages.
- **Edit**: Update existing posts and replace cover images with automatic old-image cleanup.
- **Delete**: Remove posts and automatically delete associated uploaded image files from disk.

### 🔒 Admin Authentication
- **Secure Sessions**: Protected routes (`/new`, `/posts/:id/edit`, `/posts/:id/delete`, comment deletion) require an active admin session using `express-session`.
- **Password Hashing**: Uses `bcryptjs` with 10 salt rounds to securely hash and verify admin credentials.
- **UI Guarding**: Admin-only controls (`+ New Post`, `Edit`, `Delete`) automatically hide from public visitors.

### ❤️ Interactive Like / Unlike System
- **AJAX / Fetch API**: Users can like or unlike posts instantly without triggering a full page reload.
- **Atomic Database Updates**: Uses MongoDB's `$inc` operator for race-condition-free counter updates.
- **LocalStorage Persistence**: Browser `localStorage` remembers which posts the user has liked across page reloads.

### 💬 Reader Comments & Moderation
- **Embedded Document Model**: Comments are stored natively inside each MongoDB post document using embedded sub-documents.
- **Anonymous Reader Comments**: Anyone can leave comments on blog posts.
- **Admin Moderation**: Admin users can delete inappropriate comments with a single click (`$pull` operator).

### 🖼️ Image Uploads & Responsive Layouts
- **Multer Integration**: Supports image file uploads up to 5MB with MIME type validation.
- **Responsive Display**: 
  - **Feed View**: Images use `object-fit: cover` with a `360px` max-height to ensure uniform, compact cards.
  - **Detail View**: Images display at full natural dimensions on the single post page.

### 🔍 Real-Time Post Search
- Searches titles and body content using MongoDB case-insensitive regex queries (`$regex` / `$options: "i"`).

### 📖 Estimated Reading Time
- Server-side calculation helper estimating reading time based on a standard 200 WPM reading speed.

### 🌤️ Geolocation Weather & Quote Widgets
- **Live Weather**: Detects client IP via `ipwho.is` and fetches local temperature and weather status from the `Open-Meteo API` (cached for 1 hour).
- **Quote of the Day**: Fetches inspirational quotes from `API Ninjas`.
- **Fault-Tolerant Design**: Homepage continues to load seamlessly even if third-party APIs fail.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js (v5), MongoDB, Mongoose ODM
- **Authentication**: `express-session`, `bcryptjs`
- **File Uploads**: `multer`
- **Frontend Engine**: EJS (Embedded JavaScript templates with EJS Partials)
- **Styling**: Vanilla CSS3 (Flexbox, CSS Grid, Smooth Animations)
- **APIs & Utilities**: `axios`, `dotenv`

---

## 📂 Project Directory Structure

```text
pen-and-pixel/
├── helpers/
│   └── readingTime.js       # Reading time estimation helper
├── middleware/
│   └── requireAuth.js       # Route protection middleware for admin routes
├── public/
│   ├── css/
│   │   └── style.css        # Clean, modular design system & responsive layout
│   ├── images/              # Uploaded post cover images (managed by Multer)
│   └── js/
│       └── script.js        # Client-side JavaScript (character counters & AJAX like toggle)
├── views/
│   ├── partials/
│   │   ├── head.ejs         # Reusable HTML head & stylesheet links
│   │   ├── header.ejs       # Reusable top navigation header & search bar
│   │   └── footer.ejs       # Reusable footer & client script tags
│   ├── home.ejs             # Main blog feed, search results, weather & quote widgets
│   ├── post.ejs             # Single post view & comments section
│   ├── new.ejs              # Create new post form
│   ├── edit.ejs             # Edit post form
│   └── login.ejs            # Admin login view
├── .env                     # Environment variables (git-ignored)
├── index.js                 # Express application server & MongoDB models
├── package.json             # Node dependencies and project metadata
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) running locally on port `27017` (or a MongoDB Atlas connection string)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AbdoElkafrawy/pen-and-pixel.git
   cd pen-and-pixel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   # Database connection
   MONGODB_URI=mongodb://127.0.0.1:27017/blog

   # Application Port
   PORT=3000

   # API Ninjas key for Quotes
   API_NINJAS_KEY=your_api_ninjas_key_here

   # Admin Authentication (choose your own strong password and session secret)
   ADMIN_PASSWORD=your_secure_admin_password_here
   SESSION_SECRET=your_random_session_secret_key_here
   ```

4. **Start the application**
   ```bash
   # Using nodemon for auto-reloading
   npx nodemon index.js

   # Or standard node
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`.

---

## 👨‍💻 Author

**Abdellatif Elkafrawy**
- GitHub: [@AbdoElkafrawy](https://github.com/AbdoElkafrawy)

---

## 📄 License

This project is licensed under the **MIT License**.