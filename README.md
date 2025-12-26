# Xandeum Explorer 🔍

A fast, human-readable network explorer for the Xandeum decentralized storage network.

**Inspired by [Helius Orb](https://orb.helius.dev)** - bringing the same clean, intuitive experience to Xandeum.

## Features

### 🌐 Network Explorer
- **Real-time node tracking** - Monitor all pNodes on the network
- **Health scoring** - Composite health scores (0-100) for each node
- **Geographic visualization** - See nodes on a world map
- **Leaderboards** - Top nodes by health, uptime, and more

### 🤖 AI-Powered Insights
- **Magic Search** - Natural language queries like "healthy nodes in Germany"
- **Node Diagnostics** - AI analysis of individual node health
- **Network Briefing** - Daily AI-generated network summary
- **Explain with AI** - Human-readable explanations of node metrics

### 📊 Analytics
- **Network statistics** - Total nodes, online/offline, performance metrics
- **Distribution charts** - Versions, countries, health grades
- **Traffic analysis** - Packets sent/received, active streams

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/xandeum/xandeum-explorer.git
cd xandeum-explorer

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Add your OPENROUTER_API_KEY for AI features

# Start development server
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## API Endpoints

### Network & Nodes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/network` | GET | Full network statistics |
| `/network/summary` | GET | Condensed network summary |
| `/nodes` | GET | List all nodes (paginated) |
| `/node/:ip` | GET | Detailed node information |
| `/search` | GET | Search with query params |
| `/map` | GET | Geographic markers for map |

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
| `/ai/briefing` | GET | AI network briefing |
| `/ai/query` | POST | Ask questions about network |
| `/ai/explain/:ip` | GET | AI explanation of node |

## Example Requests

### Get Network Stats
```bash
curl http://localhost:3000/network
```

### Search Nodes
```bash
# By query params
curl "http://localhost:3000/search?country=Germany&status=online"

# By natural language (AI)
curl -X POST http://localhost:3000/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query": "healthy nodes with low CPU usage in Europe"}'
```

### Get Node Details
```bash
curl http://localhost:3000/node/192.168.1.1
```

### AI Diagnostics
```bash
curl -X POST http://localhost:3000/ai/diagnose \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.1"}'
```

### AI Briefing
```bash
curl http://localhost:3000/ai/briefing
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `NODE_ENV` | development | Environment |
| `LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `BOOTSTRAP_NODE_URL` | http://173.212.207.32:6000/rpc | Xandeum bootstrap node |
| `SYNC_INTERVAL_MS` | 60000 | Sync interval (ms) |
| `STATS_CONCURRENCY` | 30 | Parallel stats requests |
| `STALE_RETENTION_DAYS` | 7 | Days to keep stale nodes |
| `OPENROUTER_API_KEY` | - | OpenRouter API key for AI |
| `AI_MODEL` | meta-llama/llama-3.2-3b-instruct:free | AI model |
| `SYNC_TOKEN` | - | Optional auth token for admin endpoints |
| `ALLOWED_ORIGINS` | * | CORS allowed origins |

## Architecture

```
src/
├── index.ts          # Main server entry
├── types/            # TypeScript type definitions
│   └── index.ts
├── lib/              # Utility libraries
│   ├── logger.ts     # Structured logging
│   ├── format.ts     # Formatting utilities
│   ├── health.ts     # Health score calculation
│   ├── geo.ts        # Geolocation service
│   ├── prpc.ts       # pRPC client
│   └── ai.ts         # AI service (OpenRouter)
├── services/         # Business logic
│   ├── store.ts      # In-memory data store
│   └── sync.ts       # Background sync engine
└── routes/           # API routes
    ├── explorer.ts   # Main explorer routes
    └── ai.ts         # AI-powered routes
```

## Comparison to Orb

| Orb (Solana) | Xandeum Explorer |
|--------------|------------------|
| Transactions | Nodes (pNodes) |
| Accounts/Wallets | Node IPs/Pubkeys |
| Programs | Versions |
| Validators | Storage Nodes |
| TPS | Packets/second |
| Epoch Progress | Sync Status |
| AI Explanations | ✅ AI Explanations |
| Heatmaps | 🔜 Coming soon |
| Time filters | 🔜 Coming soon |

## Contributing

Contributions are welcome! Please read our contributing guidelines first.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Xandeum Network](https://xandeum.network)
- [Documentation](https://docs.xandeum.network)
- [Discord](https://discord.gg/xandeum)
