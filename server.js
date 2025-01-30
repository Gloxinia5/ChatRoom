require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Database and Collection Name
const DB_NAME = 'chatApp';
const COLLECTION_NAME = 'messages';

async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db(DB_NAME).command({ ping: 1 });
    console.log("Connected to MongoDB!");
    return client.db(DB_NAME).collection(COLLECTION_NAME);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// Initialize the app
async function startServer() {
  const messagesCollection = await connectToMongoDB();
  
  app.use(express.static('public'));

  io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // Send message history
    try {
      const messages = await messagesCollection.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();
      socket.emit('message_history', messages.reverse());
    } catch (err) {
      console.error('Error fetching messages:', err);
    }

    // Handle new messages
    socket.on('new_message', async (data) => {
      try {
        const newMessage = {
          username: data.username,
          message: data.message,
          timestamp: new Date()
        };

        // Insert into MongoDB
        const result = await messagesCollection.insertOne(newMessage);
        
        // Broadcast to all clients
        io.emit('new_message', {
          ...newMessage,
          _id: result.insertedId
        });
      } catch (err) {
        console.error('Error saving message:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);