# Xandeum Network Explorer

A TypeScript-based analytics tool for exploring and monitoring the [Xandeum](https://xandeum.network) decentralized storage network built on Solana.

## Features

### CLI Client (`client.ts`)
- 📊 **Network Statistics** - Real-time view of active pNodes in the gossip network
- 📈 **Version Distribution** - Analyze software versions across the network
- 🌍 **Port Analysis** - Track port usage and network configuration
- 🖥️ **Bootstrap Node Stats** - CPU, RAM, uptime, and packet statistics
- 🎨 **Visual Analytics** - ASCII bar charts and formatted tables

### API Server (`server.ts`)
- 🔄 **Auto-sync Crawler** - Periodically fetches and caches network data (60s interval)
- 🚀 **REST API** - Expose network data via HTTP endpoints
- 📡 **CORS Enabled** - Ready for frontend integration
- ⚡ **Fast In-Memory Cache** - Instant responses for network queries

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- TypeScript

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd xand

# Install dependencies
npm install

# TypeScript is already configured in tsconfig.json
```

## Usage

### Running the CLI Client

Fetch and display current network statistics:

```bash
npx ts-node client.ts
```

**Output includes:**
- Total active nodes and unique IPs
- Version distribution with visual bars
- Port distribution analysis
- Bootstrap node performance metrics
- Sample node listing

### Running the API Server

Start the background crawler and REST API:

```bash
npx ts-node server.ts
```

The server starts on `http://localhost:3000` with the following endpoints:

#### Endpoints

**`GET /`**
- Health check endpoint
- Returns: `"Xandeum Analytics Backend is Active 🟢"`

**`GET /pnodes`**
- List all cached pNodes
- Returns:
```json
{
  "meta": {
    "total_nodes": 242,
    "active_nodes": 242,
    "last_sync": "2025-12-23T10:30:00.000Z",
    "is_syncing": false
  },
  "nodes": [
    {
      "ip": "159.195.10.191",
      "address": "159.195.10.191:9001",
      "version": "0.8.0",
      "status": "Active",
      "lastSeen": "2025-12-23T10:30:00.000Z"
    }
    // ... more nodes
  ]
}
```

**`GET /stats`**
- Network-wide analytics and bootstrap node statistics
- Returns:
```json
{
  "network": {
    "total_nodes": 242,
    "unique_ips": 242,
    "last_sync": "2025-12-23T10:30:00.000Z"
  },
  "bootstrap": {
    "cpu_percent": 0.65,
    "ram_used": 735395840,
    "ram_total": 12541607936,
    "uptime": 730362,
    "active_streams": 2,
    "packets_sent": 26698409,
    "packets_received": 24008184
  },
  "versions": {
    "0.8.0": 190,
    "0.7.3": 28,
    "0.8.0-trynet.20251222060435.f252209": 19
  },
  "ports": {
    "9001": 213,
    "53695": 1
  }
}
```

**`GET /health`**
- Server health and status
- Returns:
```json
{
  "status": "healthy",
  "uptime": 45.2,
  "cache_size": 243,
  "last_sync": "2025-12-23T10:30:00.000Z",
  "is_syncing": false
}
```

## Project Structure

```
xand/
├── client.ts          # CLI tool for network exploration
├── server.ts          # REST API server with background crawler
├── package.json       # Dependencies and project metadata
├── tsconfig.json      # TypeScript configuration
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

## Configuration

### Bootstrap Node

The default bootstrap node is configured as:
```typescript
const BOOTSTRAP_NODE_URL = "http://173.212.207.32:6000/rpc";
```

You can modify this in either `client.ts` or `server.ts` to point to a different coordinator node.

### Server Port

Default server port is `3000`. Change it in `server.ts`:
```typescript
const PORT = 3000;
```

### Sync Interval

The crawler syncs every 60 seconds by default. Adjust in `server.ts`:
```typescript
setInterval(runCrawler, 60 * 1000); // 60 seconds
```

## Technology Stack

- **TypeScript** - Type-safe development
- **Hono** - Lightweight web framework
- **Axios** - HTTP client for RPC calls
- **Zod** - Runtime type validation
- **ts-node** - Direct TypeScript execution

## About Xandeum

Xandeum is a scalable storage layer built on Solana that enables exabyte-scale data storage for decentralized applications (sedApps). It solves the blockchain storage trilemma by providing:

- **Scalability** - Distributed pNode network for massive data capacity
- **Smart Contract Integration** - Native Solana integration
- **Random Access** - Fast, granular data retrieval

Learn more at [xandeum.network](https://xandeum.network)

## API Architecture

Individual pNodes **do not expose public RPC endpoints** for security reasons. This tool:
1. Queries the bootstrap node for network-wide data via `get-pods`
2. Caches node information from the gossip network
3. Fetches aggregate statistics from the bootstrap node
4. Serves this data through a REST API for easy consumption

## Development

```bash
# Run client in development mode
npx ts-node client.ts

# Run server in development mode
npx ts-node server.ts

# Type checking
npx tsc --noEmit
```

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## License

ISC

## Acknowledgments

Built for the Xandeum community to explore and monitor the decentralized storage network.
