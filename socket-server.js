const { createServer } = require("http");
const { Server } = require("socket.io");
const { gameStore, generateGameCode, generatePlayerId } = require("./dist/lib/game-store"); // Use compiled JS

// We need to compile TS files first. Run `npm run build` before starting this server.
// Make sure your tsconfig.json has "outDir": "./dist" or similar.

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for simplicity - tighten this in production!
    methods: ["GET", "POST"]
  }
});

console.log("🚀 Socket server starting...");

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // --- Game Creation ---
  socket.on("create_game", () => {
    console.log(`Received create_game from ${socket.id}`);
    try {
        const gameCode = generateGameCode();
        const playerId = generatePlayerId(); // Generate ID for the creator

        const newGame = {
            gameCode: gameCode,
            players: [{ id: playerId, socketId: socket.id }], // Store player ID and socket ID
            status: 'waiting',
            // Add other game state properties as needed
        };
        gameStore.addGame(newGame);
        console.log(`Game created: ${gameCode} by ${playerId}`);

        socket.join(gameCode); // Make the creator join the Socket.IO room
        console.log(`${socket.id} joined room ${gameCode}`);

        // Emit back to the creator
        socket.emit("game_created", { gameCode, playerId });

    } catch (error) {
        console.error("Error creating game:", error);
        socket.emit("error", { message: "Failed to create game." });
    }
  });

  // --- Game Joining ---
  socket.on("join_game", ({ gameCode }) => {
      console.log(`Received join_game for ${gameCode} from ${socket.id}`);
      try {
          const game = gameStore.getGame(gameCode);

          if (!game) {
              console.warn(`Game not found: ${gameCode}`);
              socket.emit("error", { message: `Game code '${gameCode}' not found.` });
              return;
          }

          if (game.players.length >= 2) {
               // Check if the joining player is already in the game (reconnecting/refreshing)
              const existingPlayer = game.players.find(p => p.socketId === socket.id);
              if (existingPlayer) {
                  console.log(`Player ${existingPlayer.id} (${socket.id}) rejoining room ${gameCode}`);
                  socket.join(gameCode); // Re-join room if disconnected
                  // Maybe emit something to confirm rejoin?
                  socket.emit("game_joined", { // Emit back to joining player
                      gameCode: game.gameCode,
                      playerId: existingPlayer.id,
                      opponentId: game.players.find(p => p.id !== existingPlayer.id)?.id, // Send opponent ID if exists
                      gameStatus: game.status
                  });
                  return;
              } else {
                  console.warn(`Game full: ${gameCode}`);
                  socket.emit("error", { message: `Game '${gameCode}' is full.` });
                  return;
              }
          }

          // Add the new player
          const newPlayerId = generatePlayerId();
          const newPlayer = { id: newPlayerId, socketId: socket.id };
          const updatedPlayers = [...game.players, newPlayer];
          const updatedStatus = updatedPlayers.length === 2 ? 'placing_ships' : game.status; // Update status

          gameStore.updateGame(gameCode, { players: updatedPlayers, status: updatedStatus });
          console.log(`Player ${newPlayerId} added to game ${gameCode}. Status: ${updatedStatus}`);

          socket.join(gameCode); // Make the joining player join the Socket.IO room
          console.log(`${socket.id} joined room ${gameCode}`);

          const opponent = game.players[0]; // The first player is the opponent

          // Emit back to the joining player
          socket.emit("game_joined", {
                gameCode: game.gameCode,
                playerId: newPlayerId, // Their new ID
                opponentId: opponent.id,
                gameStatus: updatedStatus
           });

          // Emit to the *other* player (the creator) in the room
          socket.to(gameCode).emit("player_joined", {
                opponentId: newPlayerId, // Tell the creator who joined
                gameStatus: updatedStatus
           });

          console.log(`Notified room ${gameCode} about player join.`);


      } catch (error) {
          console.error(`Error joining game ${gameCode}:`, error);
          socket.emit("error", { message: `Failed to join game '${gameCode}'.` });
      }
  });

  // --- Disconnection ---
  socket.on("disconnect", (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id}, Reason: ${reason}`);
    // TODO: Handle player disconnection from games
    // - Find which game the socket was in
    // - Notify the other player
    // - Potentially end the game or allow reconnection
  });

  // --- Placeholder for future game actions ---
  socket.on("place_ships", (data) => {
      console.log(`Received place_ships from ${socket.id}:`, data);
      // TODO: Validate ships, find game, update game state, notify opponent
      // const { gameCode, ships } = data;
      // const game = gameStore.getGame(gameCode);
      // const player = game?.players.find(p => p.socketId === socket.id);
      // ... validation ...
      // gameStore.updateGame(...)
      // io.to(gameCode).emit("game_update", { /* new game state */ });
  });

   socket.on("make_guess", (data) => {
      console.log(`Received make_guess from ${socket.id}:`, data);
      // TODO: Validate guess, find game, update game state, check hit/miss/sink/win, notify players
      // const { gameCode, coordinates } = data;
      // const game = gameStore.getGame(gameCode);
      // const player = game?.players.find(p => p.socketId === socket.id);
      // ... validation ...
      // Determine hit/miss
      // Check for sink/win
      // gameStore.updateGame(...)
      // io.to(gameCode).emit("game_update", { /* guess result, new game state */ });
      // if (sunk) io.to(gameCode).emit("ship_sunk", { ... });
      // if (win) io.to(gameCode).emit("game_over", { ... });
   });

});

// --- Compile TypeScript before starting ---
// We need the game-store logic compiled to JS.
const { exec } = require('child_process');

console.log("Compiling TypeScript...");
exec('npx tsc', (error, stdout, stderr) => {
    if (error) {
        console.error(`TypeScript compilation failed: ${error}`);
        console.error(stderr);
        process.exit(1); // Exit if compilation fails
    }
    console.log("TypeScript compiled successfully.");
    console.log(stdout);

    // Start the server only after successful compilation
    const PORT = process.env.PORT || 3001; // Use a different port than Next.js
    httpServer.listen(PORT, () => {
    console.log(`👂 Socket.IO server listening on port ${PORT}`);
    });
});
