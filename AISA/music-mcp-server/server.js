import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';

dotenv.config();

// Your local database (we will expand this in Step 2)
let songDatabase = [];

// Helper function to securely authenticate with Spotify
async function getSpotifyToken() {
  const authString = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

const server = new Server({ name: "music-database-server", version: "1.1.0" }, { capabilities: { tools: {} } });

// Register the Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_spotify",
        description: "Search the global Spotify database to find tracks based on user queries (genre, artist, mood, etc).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query (e.g., 'Electronic', 'Daft Punk', 'Upbeat workout music')" },
            limit: { type: "number", description: "Number of tracks to return (default 3)" }
          },
          required: ["query"]
        }
      }
    ]
  };
});

// Handle the Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  
  if (request.params.name === "search_spotify") {
    const query = request.params.arguments.query;
    const limit = request.params.arguments.limit || 3;
    
    try {
      const token = await getSpotifyToken();
      
      // Hit the Spotify Search API
      const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const searchData = await searchResponse.json();
      
      // Clean up the massive Spotify JSON into a neat format for our Agent
      const cleanTracks = searchData.tracks.items.map(track => ({
        spotify_id: track.id,
        title: track.name,
        artist: track.artists[0].name,
        duration: track.duration_ms,
        
        // 1. Rename to audioUrl so agent.js can find it
        audioUrl: track.preview_url || "No preview available from Spotify", 
        
        coverArtUrl: track.album.images[0]?.url,
        
        // 2. Inject a dummy Author Wallet so the transaction doesn't go to 'undefined'
        // Replace this with the separate testing wallet you created earlier!
        walletAddress:"0x0cB8eBE55d85aaeF274B1272A0B906efA0a66CBa"
      }));

      return { content: [{ type: "text", text: JSON.stringify(cleanTracks, null, 2) }] };
      
    } catch (error) {
      return { content: [{ type: "text", text: `Spotify API Error: ${error.message}` }] };
    }
  }
  
  throw new Error("Tool not found");
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Music MCP Server running on stdio");
}

run().catch((error) => console.error("Server error:", error));