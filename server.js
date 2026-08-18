const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({length: 6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function broadcastRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit("room:update", {
    players: [...room.players.values()].map(p => ({id:p.id, name:p.name, color:p.color})),
    hostId: room.hostId,
    started: room.started,
    puzzle: room.puzzle,
    solution: room.solution,
    board: room.board,
    scores: room.scores
  });
}

io.on("connection", socket => {
  socket.on("room:create", ({name}, cb) => {
    const code = makeRoomCode();
    const player = {id: socket.id, name: String(name || "Player 1").slice(0,20), color:"#2563eb"};
    rooms.set(code, {
      players: new Map([[socket.id, player]]),
      hostId: socket.id,
      started: false,
      puzzle: null,
      solution: null,
      board: null,
      scores: {[socket.id]: 0}
    });
    socket.join(code);
    socket.data.room = code;
    cb({ok:true, code});
    broadcastRoom(code);
  });

  socket.on("room:join", ({code,name}, cb) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ok:false,error:"Room not found."});
    if (room.players.size >= 2) return cb({ok:false,error:"This room already has two players."});
    const player = {id: socket.id, name: String(name || "Player 2").slice(0,20), color:"#dc2626"};
    room.players.set(socket.id, player);
    room.scores[socket.id] = 0;
    socket.join(code);
    socket.data.room = code;
    cb({ok:true, code});
    broadcastRoom(code);
  });

  socket.on("game:start", ({puzzle,solution}) => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || room.hostId !== socket.id || room.players.size < 2) return;
    room.started = true;
    room.puzzle = puzzle;
    room.solution = solution;
    room.board = puzzle.slice();
    for (const id of Object.keys(room.scores)) room.scores[id] = 0;
    broadcastRoom(code);
  });

  socket.on("game:move", ({index,value}) => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || !room.started || !Number.isInteger(index) || index<0 || index>80) return;
    value = Number(value);
    if (value < 0 || value > 9) return;
    // Only empty cells can be changed; correct entries earn a point.
    if (room.puzzle[index] !== 0) return;
    room.board[index] = value;
    if (value === room.solution[index]) room.scores[socket.id] += 1;
    broadcastRoom(code);
  });

  socket.on("game:reset", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || room.hostId !== socket.id || !room.started) return;
    room.board = room.puzzle.slice();
    for (const id of Object.keys(room.scores)) room.scores[id] = 0;
    broadcastRoom(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    room.players.delete(socket.id);
    delete room.scores[socket.id];
    if (room.players.size === 0) rooms.delete(code);
    else {
      room.hostId = [...room.players.keys()][0];
      room.started = false;
      room.puzzle = room.solution = room.board = null;
      broadcastRoom(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Multiplayer Sudoku running on port ${PORT}`));
