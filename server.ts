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
  turn_index: number;
}

interface RollPayload {
  position: [number, number, number];
  rotation: [number, number, number];
  localImpulse: [number, number, number];
  localImpulsePoint: [number, number, number];
  torque: [number, number, number];
}

const users: Map<string, User> = new Map();
let current_turn = 0;
const scores: Map<number, number> = new Map();

const sendToAll = (key: string, message: any) => {
  io.emit(key, message);
};

const getPlayers = () => [...users.values()].filter((user) => user.type === "player");

const getNextAvailableTurnIndex = (): number => {
  const players = getPlayers();
  const player_turn_indexes = players.map((player) => player.turn_index);
  const max_player_turn_index = Math.max(...player_turn_indexes);
  // check if -Infinity is max_player_turn_index
  if (max_player_turn_index === -Infinity) {
    return players.length ?? 0;
  }
  return max_player_turn_index + 1;
};

const getDefaultUser = (id: string): User => ({
  _id: id,
  name: "anonymous",
  type: "unset",
  score: 0,
  turn_index: getNextAvailableTurnIndex(),
});

let most_recent_update: any = {};

io.on("connection", (socket) => {
  users.set(socket.id, getDefaultUser(socket.id));
  sendToAll("users", JSON.stringify([...users.values()]));

  socket.on("disconnect", () => {
    users.delete(socket.id);
    // remove all unset users
    users.forEach((user, id) => {
      if (user.type === "unset") {
        users.delete(id);
      }
    });

    // reset turn indexes
    const players = getPlayers();
    players.forEach((player, index) => {
      users.set(player._id, {
        ...player,
        turn_index: index,
      });
    });

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

  socket.on("roll", (payload: [RollPayload, RollPayload, RollPayload]) => {
    const [dice_1, dice_2, dice_3] = payload;
    sendToAll("roll", [dice_1, dice_2, dice_3]);
  });

  socket.on("roll-result", (payload: any) => {
    const [dice_1, dice_2, dice_3] = payload.roll;
    scores.set(payload.turn, payload);
    
    const scoresObj: Record<string, any> = {};
    scores.forEach((score, turn) => {
      scoresObj[`${turn}`] = score;
    });
    console.debug(scoresObj)

    sendToAll("roll-result", JSON.stringify(scoresObj));
    if (current_turn === payload.turn) {
      const next_turn_index = (current_turn + 1) % getPlayers().length;
      current_turn = next_turn_index;
      sendToAll("turn", current_turn);
    }
  });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/api/game", (req, res) => {
  res.send({
    users: [...users.values()],
    turn: current_turn,
  });
});

httpServer.listen(process.env.PORT || 8080);
httpServer.on("listening", () => {
  console.log(`Listening on ${httpServer.address()}`);
});
