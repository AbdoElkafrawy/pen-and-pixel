# 🖋️ Pen & Pixel

A modern full-stack blogging platform built with **Node.js**, **Express.js**, **MongoDB**, and **EJS**.

Pen & Pixel allows users to create, edit, view, and delete blog posts while enhancing the homepage with live weather information based on the visitor's location and a daily inspirational quote fetched from external APIs.

> This project was originally built as part of **The Complete Full-Stack Web Development Bootcamp** by Dr. Angela Yu and has since been expanded with additional features beyond the course requirements.

---

## ✨ Features

### 📝 Blog Management
- Create new blog posts
- View individual posts
- Edit existing posts
- Delete posts
- Posts are permanently stored in MongoDB
- Posts displayed from newest to oldest

### 📖 Reading Time
- Automatically estimates the reading time for every post.
- Reading time is calculated server-side using a custom helper function.

### 🌤️ Live Weather Widget
- Detects the visitor's approximate location using their IP address.
- Displays:
  - Current city
  - Current temperature
  - Feels-like temperature
  - Weather description

### 💬 Quote of the Day
- Fetches a random inspirational quote from the API Ninjas Quotes API.
- Uses API authentication with a secure API key stored in environment variables.

### 🛡️ Fault-Tolerant Homepage
The homepage is designed so optional external services don't prevent the blog from loading.

If:
- Weather API fails ✅ Posts still load
- Quote API fails ✅ Posts still load

---

# 🛠️ Built With

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose

### Frontend
- HTML5
- CSS3
- EJS

### APIs
- Open-Meteo API
- IPAPI
- API Ninjas Quotes API

### Other Packages
- Axios
- Dotenv

---

# 📂 Project Structure

```
pen-and-pixel/
│
├── helpers/
│   └── readingTime.js
│
├── public/
│   └── css/
│
├── views/
│   ├── home.ejs
│   ├── new.ejs
│   ├── post.ejs
│   └── edit.ejs
│
├── index.js
├── package.json
└── README.md
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/AbdoElkafrawy/pen-and-pixel.git
```

Navigate into the project

```bash
cd pen-and-pixel
```

Install dependencies

```bash
npm install
```

---

# ⚙️ Environment Variables

Create a `.env` file in the project's root directory.

```env
MONGODB_URI=your_mongodb_connection_string
API_NINJAS_KEY=your_api_ninjas_api_key
PORT=3000
```

---

# ▶️ Running the Project

Start the server

```bash
npm start
```

or

```bash
nodemon index.js
```

Open your browser and visit

```
http://localhost:3000
```

---

# 📸 Screenshots

Screenshots will be added as the project continues to evolve.

---

# 🎯 Future Improvements

- 🔍 Search posts
- 🏷️ Categories & tags
- 🖼️ Image uploads
- ❤️ Like system
- 💬 Comments
- 👤 User authentication
- 📱 Responsive mobile improvements
- 🌙 Dark mode
- 📄 Pagination
- ☁️ Deploy the application online

---

# 📚 What I Learned

While building this project I practiced:

- Express routing
- Server-side rendering with EJS
- MongoDB CRUD operations
- Mongoose models and schemas
- Axios for server-side API requests
- API authentication using request headers
- Environment variables with Dotenv
- Organizing Express applications
- Building reusable helper functions
- Error handling with async/await
- Gracefully handling failures from third-party APIs

---

# 👨‍💻 Author

**Abdellatif Elkafrawy**

GitHub:
https://github.com/AbdoElkafrawy

---

# 📄 License

This project is licensed under the MIT License.