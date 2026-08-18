# Multiplayer Sudoku

A simple online 2-player Sudoku game using Node.js, Express and Socket.IO.

## Run locally

1. Install Node.js.
2. Open a terminal in this folder.
3. Run:
   npm install
   npm start
4. Open http://localhost:3000
5. Create a room and give the 6-character code to your friend.

## Put it online

Deploy the folder to a Node.js host that supports WebSockets (for example Render, Railway, Fly.io, or your own VPS). The app listens on the `PORT` environment variable.

## Game rules

- Two players share one live board.
- Host starts a new random Sudoku.
- Empty cells can be filled by either player.
- Correct entries earn one point.
- The board synchronizes instantly through Socket.IO.
