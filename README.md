# Xandeum Explorer

> A modern, AI-powered network explorer for the Xandeum decentralized storage network

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

**Inspired by [Helius Orb](https://orb.helius.dev)** - bringing the same clean, intuitive experience to Xandeum.

---

## 📚 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running Locally](#running-locally)
- [Deployment](#deployment)
  - [Deploy to Vercel](#deploy-to-vercel)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Xandeum Explorer provides real-time monitoring and analytics for the Xandeum decentralized storage network. Built with TypeScript, Express, and Next.js, it offers both a powerful REST API and a beautiful web dashboard.

### Key Features

- 🌐 **Real-time Network Monitoring** - Track all pNodes across the network
- 🤖 **AI-Powered Search** - Natural language queries with LLM integration
- 📊 **Advanced Analytics** - Health scores, distribution charts, and leaderboards
- 🗺️ **Geographic Visualization** - Interactive world map of node locations
- 🔍 **Deep Node Insights** - Detailed metrics and AI diagnostics per node

---

## Features

### Network Explorer
- Real-time node tracking and health monitoring
- Composite health scores (0-100) for each node
- Geographic distribution visualization
- Performance leaderboards (health, uptime, traffic)

### AI-Powered Insights
- **Magic Search** - Query with natural language ("healthy nodes in Germany")
- **Node Diagnostics** - AI-powered health analysis for individual nodes
- **Network Briefing** - Daily AI-generated network summary
- **Explain with AI** - Human-readable metric explanations

### Analytics Dashboard
- Network-wide statistics (nodes online/offline, performance)
- Distribution charts (versions, countries, health grades)
- Traffic analysis (packets, streams, resource usage)
- Historical trends and comparisons

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 8.x or higher (or **yarn** 1.22+)
- **Git**

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/xandeum/xandeum-explorer.git
cd xandeum-explorer
```

2. **Install dependencies**

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd xand-dashboard
npm install
cd ..
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration)).

### Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Xandeum Network
BOOTSTRAP_NODE_URL=http://173.212.207.32:6000/rpc

# Sync Configuration
SYNC_INTERVAL_MS=60000
STATS_CONCURRENCY=30
STALE_RETENTION_DAYS=7

# AI Configuration (OpenRouter)
OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Security (Optional)
SYNC_TOKEN=
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**Configuration Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Backend server port |
| `HOST` | 0.0.0.0 | Server host binding |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level (debug/info/warn/error) |
| `BOOTSTRAP_NODE_URL` | http://173.212.207.32:6000/rpc | Xandeum bootstrap node endpoint |
| `SYNC_INTERVAL_MS` | 60000 | Network sync interval (milliseconds) |
| `STATS_CONCURRENCY` | 30 | Parallel stats requests limit |
| `STALE_RETENTION_DAYS` | 7 | Days to retain stale node data |
| `OPENROUTER_API_KEY` | - | OpenRouter API key for AI features |
| `AI_MODEL` | meta-llama/llama-3.3-70b-instruct:free | AI model identifier |
| `SYNC_TOKEN` | - | Optional auth token for admin endpoints |
| `ALLOWED_ORIGINS` | * | CORS allowed origins (comma-separated) |

### Running Locally

**Backend (API Server):**

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

The API will be available at `http://localhost:3000`

**Frontend (Dashboard):**

```bash
cd xand-dashboard

# Development mode
npm run dev

# Production build
npm run build
npm start
```

The dashboard will be available at `http://localhost:3001` (or as configured in Next.js)

---

## Deployment

### Deploy to Vercel

Vercel is the recommended platform for deploying the Next.js dashboard. Follow these steps:

#### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (or GitLab/Bitbucket):

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

#### Step 2: Deploy Frontend to Vercel

1. **Sign in to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Project**
   - Click **"Add New..."** → **"Project"**
   - Select your repository
   - Vercel will auto-detect the Next.js app in `xand-dashboard/`

3. **Configure Build Settings**
   - **Framework Preset:** Next.js
   - **Root Directory:** `xand-dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

4. **Add Environment Variables**
   
   In the Vercel project settings, add these environment variables:

   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```

   *(You'll need to deploy the backend first - see below)*

5. **Deploy**
   - Click **"Deploy"**
   - Vercel will build and deploy your app
   - You'll get a URL like `https://xandeum-explorer.vercel.app`

#### Step 3: Deploy Backend API

The backend requires a Node.js runtime. You have several options:

**Option A: Vercel Serverless Functions** (Recommended for small scale)

1. Create a new Vercel project for the backend
2. Use the root directory (not `xand-dashboard/`)
3. Add a `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ]
}
```

4. Add environment variables in Vercel dashboard
5. Deploy

**Option B: Railway / Render / DigitalOcean** (Recommended for production)

For persistent connections and background sync:

1. **Railway.app:**
   - Connect your GitHub repo
   - Set root directory to `/`
   - Add environment variables
   - Deploy automatically

2. **Render.com:**
   - Create a new Web Service
   - Connect repo
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Add environment variables

3. **DigitalOcean App Platform:**
   - Create app from GitHub
   - Configure build: `npm install && npm run build`
   - Run: `npm start`
   - Set environment variables

#### Step 4: Connect Frontend to Backend

1. Update the frontend environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.railway.app
   ```

2. Update backend CORS settings:
   ```env
   ALLOWED_ORIGINS=https://xandeum-explorer.vercel.app
   ```

3. Redeploy both services

#### Step 5: Custom Domain (Optional)

1. In Vercel project settings → **Domains**
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL is automatic

---

## API Reference

## API Reference

The Explorer API provides comprehensive endpoints for network monitoring and AI-powered insights.

**Base URL:** `http://localhost:3000` (development) or your deployed URL

### Network & Nodes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/network` | GET | Full network statistics |
| `/network/summary` | GET | Condensed network summary |
| `/nodes` | GET | List all nodes (paginated) |
| `/node/:ip` | GET | Detailed node information |
| `/search` | GET | Search nodes with query params |
| `/map` | GET | Geographic markers for map visualization |

### Distributions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/distribution/versions` | GET | Node version distribution |
| `/distribution/countries` | GET | Geographic distribution |
| `/distribution/health` | GET | Health grade distribution |

### Leaderboards

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/leaderboard/health` | GET | Top nodes by health score |
| `/leaderboard/uptime` | GET | Top nodes by uptime |

### AI Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ai/search` | POST | Natural language search |
| `/ai/diagnose` | POST | AI node diagnostics |
| `/ai/briefing` | GET | AI-generated network briefing |
| `/ai/query` | POST | Ask questions about the network |
| `/ai/explain/:ip` | GET | AI explanation of node metrics |

### Example Requests

**Get Network Stats:**
```bash
curl http://localhost:3000/network
```

**Search Nodes:**
```bash
# Query params
curl "http://localhost:3000/search?country=Germany&status=online"

# Natural language (AI)
curl -X POST http://localhost:3000/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query": "healthy nodes with low CPU usage in Europe"}'
```

**Get Node Details:**
```bash
curl http://localhost:3000/node/192.168.1.1
```

**AI Diagnostics:**
```bash
curl -X POST http://localhost:3000/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.1"}'
```

---

## Architecture

### Project Structure

```
xandeum-explorer/
├── src/                      # Backend API source
│   ├── index.ts             # Main server entry point
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts
│   ├── lib/                 # Utility libraries
│   │   ├── logger.ts        # Structured logging
│   │   ├── format.ts        # Formatting utilities
│   │   ├── health.ts        # Health score calculation
│   │   ├── geo.ts           # Geolocation service
│   │   ├── prpc.ts          # pRPC client
│   │   └── ai.ts            # AI service (OpenRouter)
│   ├── services/            # Business logic
│   │   ├── store.ts         # In-memory data store
│   │   └── sync.ts          # Background sync engine
│   └── routes/              # API routes
│       ├── explorer.ts      # Explorer endpoints
│       └── ai.ts            # AI-powered endpoints
├── xand-dashboard/          # Frontend Next.js app
│   ├── app/                 # Next.js 14 App Router
│   │   ├── page.tsx         # Home page
│   │   ├── layout.tsx       # Root layout
│   │   ├── globals.css      # Global styles
│   │   ├── nodes/           # Nodes page
│   │   ├── network/         # Network stats page
│   │   ├── search/          # Search page
│   │   ├── ai/              # AI assistant page
│   │   ├── map/             # World map page
│   │   ├── node/[ip]/       # Node details page
│   │   ├── components/      # React components
│   │   └── lib/             # Frontend utilities
│   ├── public/              # Static assets
│   └── package.json
├── .env                     # Environment variables
├── package.json             # Backend dependencies
├── tsconfig.json            # TypeScript config
└── README.md                # This file
```

### Tech Stack

**Backend:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **AI:** OpenRouter API (LLaMA 3.3)
- **Geolocation:** IP2Location
- **Logging:** Winston

**Frontend:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript + React
- **Styling:** Tailwind CSS
- **UI Components:** Custom + Lucide Icons
- **Data Fetching:** Native fetch API

### Data Flow

1. **Sync Engine** polls bootstrap node every 60s
2. **Store Service** maintains in-memory node registry
3. **API Routes** serve cached data with sub-millisecond latency
4. **AI Service** enriches queries with LLM analysis
5. **Dashboard** fetches from API and renders real-time UI

---

## Comparison to Helius Orb

| Orb (Solana) | Xandeum Explorer |
|--------------|------------------|
| Transactions | Nodes (pNodes) |
| Accounts/Wallets | Node IPs/Pubkeys |
| Programs | Node Versions |
| Validators | Storage Nodes |
| TPS | Packets/second |
| Epoch Progress | Sync Status |
| AI Explanations | ✅ AI Explanations |
| Heatmaps | 🔜 Coming soon |
| Time filters | 🔜 Coming soon |

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation
- Use conventional commits

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Links

- **Xandeum Network:** [xandeum.network](https://xandeum.network)
- **Documentation:** [docs.xandeum.network](https://docs.xandeum.network)
- **Discord:** [discord.gg/xandeum](https://discord.gg/xandeum)
- **GitHub:** [github.com/xandeum](https://github.com/xandeum)

---

## Support

For issues, questions, or feature requests:
- Open an issue on [GitHub](https://github.com/xandeum/xandeum-explorer/issues)
- Join our [Discord community](https://discord.gg/xandeum)
- Email: support@xandeum.network
