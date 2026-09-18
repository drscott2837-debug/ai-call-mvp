
const { Server } = require("socket.io");

const io = new Server(3001, {
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
