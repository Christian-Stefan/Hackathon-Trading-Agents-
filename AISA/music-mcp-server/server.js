import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// 1. Your Custom Database (Mocked locally for the Hackathon)
const songDatabase = [
  {
    id: "song_001",
    title: "Electric Dreams",
    artist: "Synthwave",
    genre: "Electronic",
    duration: 248,
    plays: 15200,
    audioUrl: "/audio/electric-dreams.mp3",
    coverArtUrl: "/covers/electric-dreams.jpg",
    walletAddress: "0x0cB8eBE55d85aaeF274B1272A0B906efA0a66CBa" // The receiver testnet wallet you generated earlier
  }
];

// 2. Initialize the MCP Server
const server = new Server(
  {
    name: "music-database-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 3. Define the Agent Tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_songs",
        description: "Search the music database by genre to retrieve song details and payment addresses.",
        inputSchema: {
          type: "object",
          properties: {
            genre: { type: "string", description: "The genre of the song (e.g., Electronic)" }
          },
          required: ["genre"]
        }
      }
    ]
  };
});

// 4. Handle the Agent's Request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_songs") {
    const requestedGenre = request.params.arguments.genre;
    
    // Query the database
    const results = songDatabase.filter(
      (song) => song.genre.toLowerCase() === requestedGenre.toLowerCase()
    );

    // Return the JSON directly back to the Agent
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }
  
  throw new Error("Tool not found");
});

// 5. Start the Server via Standard I/O
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Music MCP Server running on stdio");
}

run().catch((error) => console.error("Server error:", error));