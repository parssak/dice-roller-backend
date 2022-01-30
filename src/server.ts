import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  },
});

interface User {
  _id: string;
  name: string;
  type: "player" | "house" | "unset";
  score: 0;
}

interface RollPayload {
  position: [number, number, number];
  rotation: [number, number, number];
  localImpulse: [number, number, number];
  localImpulsePoint: [number, number, number];
  torque: [number, number, number];
}

const users: Map<string, User> = new Map();

const sendToAll = (key: string, message: any) => {
  io.emit(key, message);
};

const getDefaultUser = (id: string): User => ({
  _id: id,
  name: "anonymous",
  type: "unset",
  score: 0,
});

io.on("connection", (socket) => {
  users.set(socket.id, getDefaultUser(socket.id));
  sendToAll("users", JSON.stringify([...users.values()]));

  socket.on("disconnect", () => {
    users.delete(socket.id);
    sendToAll("users", JSON.stringify([...users.values()]));
  });

  socket.on("join", (payload: any) => {
    users.set(socket.id, {
      ...(users.get(socket.id) ?? getDefaultUser(socket.id)),
      name: payload.name,
      type: payload.type,
    });
    sendToAll("users", JSON.stringify([...users.values()]));
  });

  socket.on("action", (payload: any) => {
    const user = users.get(socket.id);
    if (!user) {
      return;
    }
    sendToAll("users", JSON.stringify([...users.values()]));
  });

  socket.on("roll", (payload: [RollPayload, RollPayload, RollPayload]) => {
    const [dice_1, dice_2, dice_3] = payload;
    sendToAll("roll", [dice_1, dice_2, dice_3]);
  });
});

httpServer.listen(5656);
httpServer.on("listening", () => {
  console.info("listening on port 5656");
});
