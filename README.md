# ✨ Magic Story – Server

## 📖 Overview

**Magic Story** is an AI-powered storytelling application that generates engaging stories for children and users in multiple formats including **text, comic-style visuals, and video**. The platform is designed to be fun, interactive, and educational, with a focus on creativity and safe content.

---

## 🚀 Features

### 🎭 Story Generation

* Generate unique stories using AI
* Multiple themes (heroes, animals, adventure, fantasy, etc.)
* Custom prompts for personalized storytelling

### 🎨 Visual Story Modes

* 📚 **Text Mode** – Simple readable story
* 🖼️ **Comic Mode** – AI-generated images for each scene
* 🎥 **Video Mode** – Story converted into video with frames

### 👶 Kid-Friendly Design

* Simple and colorful UI
* Easy navigation for ages 6–12
* Safe and engaging content

### 🔐 Authentication System

* User Signup & Login
* Secure user sessions
* Personalized experience

### ⚙️ Settings Page

* Customize preferences
* Theme switching (dark/light mode)

### 🛠️ Admin Panel

* Manage users
* Monitor generated stories
* Control content

---

## 🧠 Technologies Used

### Frontend

* Flutter / HTML / CSS / JavaScript
* Responsive UI with animations

### Backend

* Node.js + Express.js
* REST APIs

### AI Integration

* OpenAI API (story generation)
* DALL·E (image generation)

### Media Handling

* Cloudinary (image & video hosting)
* FFmpeg (video generation)

### Database

* MongoDB (Mongoose ORM)

---

## 📂 Project Structure

```
magic_story/
│── backend/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── config/
│
│── frontend/
│   ├── screens/
│   ├── widgets/
│   └── assets/
│
│── media/
│   ├── images/
│   └── videos/
│
│── .env
│── package.json
│── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/magic-story.git
cd magic-story
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Setup Environment Variables

Create a `.env` file:

```env
CLOUDINARY_URL=your_cloudinary_url
MONGODB_URI=your_mongodb_uri
```

### 4️⃣ Run the Server

```bash
node server.js
```

---

## 📡 API Endpoints

### 🔹 Generate Story

```
POST /api/story
```

**Body:**

```json
{
  "prompt": "A brave lion saving the jungle",
  "mode": "text | comic | video"
}
```

---

## 📊 Future Enhancements

* Voice narration for stories 🎙️
* Multi-language support 🌍
* Interactive story choices 🎮
* Mobile app deployment 📱

---

## 🤝 Contribution

Contributions are welcome!
Feel free to fork the repo and submit a pull request.

---

## 📜 License

This project is licensed under the MIT License.

---

## 💡 Inspiration

Magic Story aims to combine **AI + Creativity + Education** to build a platform where imagination comes to life.

---

## 👨‍💻 Author

Developed by **Zaibten**

---

✨ *Create. Imagine. Inspire.*
