<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# VCFMP
### Village CrossFading Music Player

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://zhotheone.github.io/vcfmp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance, aesthetically pleasing local music player built with React and Vite. Designed for seamless, gapless listening experiences with a modern glassmorphic UI.

[**Live Demo**](https://zhotheone.github.io/vcfmp/)

</div>

---

## ✨ Features

- **🎧 Gapless Playback**: Intelligent preloading and crossfading between tracks for an uninterrupted listening experience.
- **📁 Smart Library**: High-speed background directory scanning using Web Workers and metadata parsing.
- **⚡ Instant Startup**: Efficient IndexedDB caching for near-instant access to your library on return visits.
- **🔍 Advanced Search**: Fast, fuzzy search across artists, albums, and tracks powered by Fuse.js.
- **🌈 Modern UI**: Dynamic themes (Monochrome, Rose Pine, Rose Pine Dawn) with fluid Framer Motion animations.
- **📱 Responsive Design**: Fully optimized for both desktop and mobile devices.
- **🌍 Media Session API**: Integrated with system media controls (Lock screen, media keys).

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: React Context + Custom Hooks
- **Storage**: [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zhotheone/vcfmp.git
   cd vcfmp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

### Build and Deploy

To create a production build:
```bash
npm run build
```

To deploy to GitHub Pages:
```bash
npm run deploy
```

---

## 🏗️ Architecture

- **`PlayerContext`**: The brain of the application, managing playback state and audio engine.
- **`LibraryWorker`**: Handles heavy-duty file scanning and metadata parsing off the main thread.
- **Dynamic Routing**: Internal navigation system for Artists, Albums, and Library views.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with ❤️ for music lovers.</p>
