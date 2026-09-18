const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 10000;

const httpServer = http.createServer(async (req, res) => {
  // Create a temporary OpenAI Realtime client token
  if (req.method === "POST" && req.url === "/realtime-token") {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime-2.1",
              audio: {
                output: {
                  voice: "marin",
                },
              },
            },
          }),
        }
      );

      const data = await response.json();

      res.writeHead(response.status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });

      res.end(JSON.stringify(data));
    } catch (error) {
      console.error("Realtime token error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });

      res.end(
        JSON.stringify({
          error: "Failed to create OpenAI Realtime session",
        })
      );
    }

    return;
  }

  // Allow browser requests
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    res.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

// Socket.IO signaling server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    const users = io.sockets.adapter.rooms.get(roomId);
    const userCount = users ? users.size : 0;

    socket.emit("room-joined", {
      roomId,
      userCount,
    });

    if (userCount > 1) {
      socket.to(roomId).emit("user-joined");
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
