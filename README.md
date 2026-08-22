# EventConnect 🎥 Virtual Event & Video Conferencing Platform


**EventConnect** is a modern, high-aesthetic web application designed for seamless event management and multi-party video conferencing. Host events, build interactive schedules, stream HD video grid calls, share screens, and chat in real-time.
This is a sample platform
---

## ✨ Features

- 🔐 **User Authentication**: Secure signup and login with JWT session handling and password encryption.
- 📅 **Event Creation & Agenda Builder**: Schedule virtual events with date, time, and multi-slot interactive agendas.
- 🔑 **Unique Event Join Codes**: Share unique 6-character room codes (e.g. `ABC123`) or direct invite links.
- 📹 **HD WebRTC Video Grid**: Responsive grid supporting local camera feeds and peer WebRTC video streams.
- 🌐 **Global STUN NAT Traversal**: Configured with Google STUN ICE servers for connection reliability worldwide.
- 🖥️ **Screen Sharing**: Broadcast desktop windows, browser tabs, or slides directly to attendees.
- 💬 **Live Meeting Chat**: Real-time group messaging stream powered by Socket.io.
- 👥 **Participant Management**: Live count drawer with microphone & camera status badges.
- 🎨 **Dark Glassmorphism Design**: Modern, responsive UI with smooth micro-interactions.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide React Icons
- **Backend**: Node.js, Express, Next.js API Routes
- **Database & ORM**: Prisma ORM, SQLite (local development default) / PostgreSQL ready
- **Real-Time & Video**: Socket.io signaling server, PeerJS (WebRTC)
- **Authentication**: Custom JWT in HTTP-only cookies, bcryptjs
There is no licene for this 
---

## 🚀 Quick Start & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/ramesh9686/video_conferencing_app.git
cd video_conferencing_app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3000
```

### 4. Initialize Database
```bash
npx prisma db push
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Directory Structure

```
video_conferencing_app/
├── prisma/
│   └── schema.prisma         # Prisma database schema & indexes
├── public/                   # Static assets
├── server.js                 # Express + Socket.io WebRTC signaling server
├── src/
│   ├── app/
│   │   ├── api/              # Auth & Event API endpoints
│   │   ├── dashboard/        # Organizer dashboard
│   │   ├── events/           # Event creation & agenda pages
│   │   ├── login/            # User sign in page
│   │   ├── meeting/[id]/     # Video Meeting Room UI & controls
│   │   ├── profile/          # User profile page
│   │   ├── register/         # Account creation page
│   │   ├── globals.css       # Design tokens & glassmorphism CSS
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Hero landing page
│   ├── components/
│   │   └── Navbar.tsx        # Responsive navigation bar
│   └── lib/
│       ├── auth.ts           # JWT token & password utilities
│       ├── db.ts             # Prisma Client singleton instance
│       └── utils.ts          # Formatting & helper utilities
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions
├── package.json              # Project dependencies & scripts
└── tailwind.config.js        # Tailwind CSS configuration
```

---

## 🌍 Production Deployment

### Database (PostgreSQL)
For production deployment on platforms like Neon or Supabase, update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Hosting Options
- **Frontend & API**: Vercel / Railway.app
- **Signaling Server**: Render.com / Railway.app
- **Database**: Neon.tech / Supabase Free Tier

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
