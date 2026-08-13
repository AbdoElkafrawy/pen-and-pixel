# 🖋️ Pen & Pixel

[![Live Demo](https://img.shields.io/badge/Live%20Demo-pen--and--pixel.onrender.com-brightgreen?style=for-the-badge&logo=render)](https://pen-and-pixel.onrender.com)

🔗 **Live Production Site**: [https://pen-and-pixel.onrender.com](https://pen-and-pixel.onrender.com)

A modern, feature-rich full-stack blogging platform built with **Node.js**, **Express.js**, **MongoDB**, **Mongoose**, **Cloudinary**, and **EJS**.

Pen & Pixel enables authors to publish and manage blog posts with cover images while providing readers with interactive capabilities like **instant post likes**, **comments**, **dark mode**, **category filtering**, **search**, **estimated reading time**, **live weather forecasts**, and **inspirational daily quotes**.

---

## ✨ Features Breakdown

### 📰 3-Column Magazine Grid Layout
- **Featured Story Hero Banner**: The newest post takes center stage at the top in a prominent 2-column featured hero card with a `⭐ Featured Story` badge.
- **3-Column Card Grid**: Remaining posts are organized in a spacious 3-column card grid across an expanded `1320px` wide container.
- **Responsive Breakpoints**: Seamlessly scales from 3 columns on desktop, to 2 columns on tablets (under 1150px), and 1 column on mobile devices (under 768px).

### 🏷️ Dynamic Category Filtering
- **Category Navigation Bar**: Interactive pill buttons at the top of the feed (`All`, `Tech`, `Politics`, `Science`, `Cinema`, `Art`, `Crypto`, `Society`).
- **Server-Side Filtering**: Clicking a category filters MongoDB query results via `?category=Name` with an active pill highlight.
- **Card Category Badges**: Every post card displays a color-coded category tag badge in its header.

### 📝 Blog Post Management (CRUD)
- **Create**: Add new posts with titles, content, categories, and cover image uploads.
- **Read**: View the magazine feed sorted chronologically, or read single post pages with full content.
- **Edit**: Update existing posts, categories, and replace cover images with automatic cleanup.
- **Delete**: Remove posts and automatically clean up associated cloud media assets.

### 🔒 Admin Authentication & Security
- **Secure Sessions**: Protected write routes (`/new`, `/posts/:id/edit`, `/posts/:id/delete`, comment deletion) require an active admin session using `express-session`.
- **Password Hashing**: Uses `bcryptjs` with 10 salt rounds to securely hash and verify admin credentials.
- **Strict Secrets Policy**: All sensitive variables (`MONGODB_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `CLOUDINARY_*`) are enforced strictly via environment variables (`process.env`) with zero hardcoded fallback credentials.
- **UI Guarding**: Admin-only controls (`+ New Post`, `Edit`, `Delete`) automatically hide from public visitors.

### ❤️ Interactive Like / Unlike System
- **AJAX / Fetch API**: Users can toggle post likes instantly without triggering a full page reload.
- **Atomic Database Updates**: Uses MongoDB's `$inc` operator for race-condition-free counter updates.
- **LocalStorage Persistence**: Browser `localStorage` remembers liked posts across sessions.

### 💬 Reader Comments & Moderation
- **Embedded Document Model**: Comments are stored natively inside each MongoDB post document using embedded sub-documents.
- **Anonymous Reader Comments**: Anyone can leave comments on blog posts.
- **Admin Moderation**: Admin users can delete inappropriate comments with a single click (`$pull` operator).

### ☁️ Cloud Image Hosting (Cloudinary)
- **Production Storage**: Uploaded cover images are stored permanently in **Cloudinary Cloud Storage** via `multer-storage-cloudinary`.
- **Ephemeral Protection**: Server restarts or deployments never wipe images.

### 🌙 Dark Mode & Adaptive Theme
- **Theme Switcher**: Instant light/dark mode toggle button with preference stored in `localStorage`.
- **Adaptive Widgets**: Weather card and post cards dynamically switch between fresh light gradients and dark slate themes.

### 🔍 Real-Time Post Search
- Searches titles and body content using MongoDB case-insensitive regex queries (`$regex` / `$options: "i"`).

### 📖 Estimated Reading Time
- Server-side calculation helper estimating reading time based on a standard 200 WPM reading speed.

### 🌤️ Geolocation Weather & Quote Widgets
- **Live Weather**: Detects client IP via `ipwho.is` and fetches local temperature and weather status from the `Open-Meteo API` (cached for 1 hour).
- **Quote of the Day**: Fetches inspirational quotes from `API Ninjas`.
- **Fault-Tolerant Design**: Homepage continues to load seamlessly even if third-party APIs fail.

### 🔐 Google OAuth 2.0 Sign-In & Role-Based Permissions
- **Google Sign-In**: Readers can log in securely using their Google accounts (`passport-google-oauth20`).
- **Author Ownership**: Registered users can publish new blog posts (`/new`) and manage their articles on a dedicated **"My Posts" Dashboard** (`/my-posts`).
- **Strict Permission Enforcement**: Registered users can **edit and delete ONLY posts they created**. Attempting to modify another author's post is strictly blocked on both the server (`403 Forbidden`) and hidden in the UI.
- **Admin Master Control**: The Admin user retains full master privileges across all posts, comment moderation, and database seeding.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js (v5), MongoDB Atlas, Mongoose ODM
- **Authentication**: Passport.js (`passport-google-oauth20`), `express-session`, `bcryptjs`
- **Media & File Storage**: `multer`, `cloudinary`, `multer-storage-cloudinary`
- **Frontend Engine**: EJS (Embedded JavaScript templates with EJS Partials)
- **Styling**: Vanilla CSS (Modular CSS custom variables, Flexbox, CSS Grid)
- **Deployment**: Render (Web Service), MongoDB Atlas (Cloud Database), Cloudinary (Cloud Storage)

---

## 🚀 Environment Variables

To run this project locally or in production, configure the following variables in your `.env` file or hosting provider:

```env
PORT=3000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/blog
ADMIN_PASSWORD=your_secure_admin_password
SESSION_SECRET=your_random_session_secret
API_NINJAS_KEY=your_api_ninjas_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

---

## 💻 Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/AbdoElkafrawy/pen-and-pixel.git
   cd pen-and-pixel
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and populate the required keys.

4. **Start the Development Server**:
   ```bash
   npm start
   # or
   npm run dev
   ```

5. **Access the Application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.
