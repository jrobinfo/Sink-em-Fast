import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// When using middleware await preparation needs to be done outside of main handler
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Game {
  gameCode: string;
  players: { id: string; socketId: string }[]; // Store socketId too
  status: 'waiting' | 'placing_ships' | 'active' | 'finished';
  // Add more game state properties here later (grids, turn, etc.)
}

// In-memory store for games - suitable for single-server instance
const games: Record<string, Game> = {};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new SocketIOServer(httpServer, {
      cors: {
          origin: "*", // Allow all origins for simplicity (adjust in production!)
          methods: ["GET", "POST"]
      }
  });

  console.log('🚀 WebSocket server starting...');

  // --- Game Logic Handlers ---
  const generateGameCode = (): string => {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (games[code]);
    return code;
  };

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('create_game', () => {
      try {
        const gameCode = generateGameCode();
        const playerId = `player_${socket.id.substring(0, 6)}`; // Use part of socket ID
        const game: Game = {
          gameCode,
          players: [{ id: playerId, socketId: socket.id }],
          status: 'waiting',
        };
        games[gameCode] = game;
        socket.join(gameCode); // Join Socket.IO room for this game
        console.log(`✨ Game created: ${gameCode} by ${playerId} (${socket.id})`);
        socket.emit('game_created', { gameCode, playerId });
      } catch (error) {
          console.error("Error creating game:", error);
          socket.emit('error', { message: 'Failed to create game' });
      }
    });

    socket.on('join_game', ({ gameCode }: { gameCode: string }) => {
      try {
        const game = games[gameCode];
        if (!game) {
          socket.emit('error', { message: `Game ${gameCode} not found.` });
          console.warn(`Player ${socket.id} tried to join non-existent game ${gameCode}`);
          return;
        }

        if (game.players.length >= 2) {
          socket.emit('error', { message: `Game ${gameCode} is full.` });
           console.warn(`Player ${socket.id} tried to join full game ${gameCode}`);
          return;
        }

        // Check if player is already in the game (e.g., reconnect)
        const existingPlayer = game.players.find(p => p.socketId === socket.id);
        if (existingPlayer) {
            socket.join(gameCode);
            console.log(`Player ${existingPlayer.id} (${socket.id}) re-joined game ${gameCode}`);
            // Maybe emit something to let them know they reconnected
            socket.emit('game_joined', { gameCode, playerId: existingPlayer.id, opponentId: game.players.find(p => p.id !== existingPlayer.id)?.id, gameStatus: game.status });
            return;
        }

        const joiningPlayerId = `player_${socket.id.substring(0, 6)}`;
        game.players.push({ id: joiningPlayerId, socketId: socket.id });
        game.status = 'placing_ships'; // Move to next phase

        socket.join(gameCode); // Join the Socket.IO room
        console.log(`🤝 Player ${joiningPlayerId} (${socket.id}) joined game ${gameCode}`);

        // Notify the joining player
        socket.emit('game_joined', {
            gameCode,
            playerId: joiningPlayerId,
            opponentId: game.players[0].id, // The creator
            gameStatus: game.status
        });

        // Notify the other player (the creator) that someone joined
        socket.to(gameCode).emit('player_joined', {
            opponentId: joiningPlayerId,
            gameStatus: game.status
        });

        console.log(`Game ${gameCode} status updated: ${game.status}`);

      } catch (error) {
          console.error(`Error joining game ${gameCode}:`, error);
          socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // TODO: Add handlers for 'place_ships', 'make_guess', etc.

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      // TODO: Handle player disconnection (e.g., notify opponent, maybe forfeit game)
      // Find which game(s) the player was in and update state
       for (const gameCode in games) {
            const game = games[gameCode];
            const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const disconnectedPlayerId = game.players[playerIndex].id;
                console.log(`Player ${disconnectedPlayerId} disconnected from game ${gameCode}`);
                // Remove player or mark as disconnected?
                // For now, just notify the other player if the game was active
                if (game.players.length === 2 && game.status !== 'waiting' && game.status !== 'finished') {
                    socket.to(gameCode).emit('opponent_disconnected', { disconnectedPlayerId });
                    // Optionally, set game status to finished or waiting again
                    // delete games[gameCode]; // Or update status
                }
                // If player was waiting alone, clean up the game
                else if (game.players.length === 1) {
                     console.log(`Cleaning up empty game ${gameCode}`);
                     delete games[gameCode];
                }
                break; // Assuming player can only be in one game
            }
        }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error('HTTP server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(` KABOOM WebSocket server listening on port ${port}`);
    });
});
