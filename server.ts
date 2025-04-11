import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient, Player as DbPlayer, Game as DbGame, Shot as DbShot } from '@prisma/client';
import { validateShipPlacement, checkShot, validateShot } from '@/lib/game-logic';
import type { 
  ShipPlacementData, 
  Ship, 
  MemoryPlayer, 
  Game, 
  FullDbGame, 
  GameStatus,
  ClientGameState,
  Shot
} from '@/lib/types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const prisma = new PrismaClient();

// When using middleware await preparation needs to be done outside of main handler
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory store for games - suitable for single-server instance
const games: Record<string, Game> = {};

// Helper function to reconstruct in-memory game state from DB
async function reconstructGameState(dbGame: FullDbGame, gameCode: string): Promise<Game> {
  const players: MemoryPlayer[] = [];
  
  for (const dbPlayer of dbGame.players) {
    let ships: Ship[] | undefined = undefined;
    if (dbPlayer.shipPlacements) {
      const placements = dbPlayer.shipPlacements as unknown as ShipPlacementData[];
      // Calculate hits for each ship based on opponent's shots
      const opponentShots = dbGame.shots.filter((shot: DbShot) => shot.playerId !== dbPlayer.id);
      ships = placements.map(p => {
        let hits = 0;
        for (let i = 0; i < p.size; i++) {
          const shipX = p.isVertical ? p.x : p.x + i;
          const shipY = p.isVertical ? p.y : p.y + i;
          if (opponentShots.some((shot: DbShot) => shot.x === shipX && shot.y === shipY && shot.isHit)) {
            hits++;
          }
        }
        return { ...p, isPlaced: true, hits };
      });
    }
    
    players.push({
      id: dbPlayer.id,
      socketId: 'unknown', // Socket ID will be updated when they connect
      ships,
      isReady: !!dbPlayer.shipPlacements, // Assume ready if ships are placed
      shots: dbGame.shots.filter((shot: DbShot) => shot.playerId === dbPlayer.id).map((s: DbShot) => ({ x: s.x, y: s.y, isHit: s.isHit }))
    });
  }

  return {
    gameCode,
    dbGameId: dbGame.id,
    players,
    status: dbGame.status as GameStatus,
    currentTurn: dbGame.currentTurnPlayerId ?? undefined,
  };
}

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

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('create_game', async () => {
      try {
        const gameCode = generateGameCode();
        const dbGame = await prisma.game.create({
          data: {
            code: gameCode,
            players: {
              create: { isHost: true }
            }
          },
          include: { players: true }
        });

        const game: Game = {
          gameCode,
          dbGameId: dbGame.id,
          players: [{ id: dbGame.players[0].id, socketId: socket.id }],
          status: 'waiting',
        };
        games[gameCode] = game;
        socket.join(gameCode);
        console.log(`✨ Game created: ${gameCode} by ${dbGame.players[0].id} (${socket.id})`);
        socket.emit('game_created', { gameCode, playerId: dbGame.players[0].id });
      } catch (error) {
          console.error("Error creating game:", error);
          socket.emit('error', { message: 'Failed to create game' });
      }
    });

    socket.on('join_game', async ({ gameCode }: { gameCode: string }) => {
      try {
        let game = games[gameCode]; // Try to find in memory first
        let dbGame: FullDbGame | null = null;

        // Fetch DB state regardless, to ensure consistency and for potential reconstruction/rejoin
        dbGame = await prisma.game.findUnique({
          where: { code: gameCode },
          include: { 
            players: true, // Includes shipPlacements implicitly
            shots: true 
          }
        });

        if (!dbGame) {
          socket.emit('error', { message: `Game code '${gameCode}' not found.` });
          return;
        }

        if (dbGame.status === 'FINISHED') {
          socket.emit('error', { message: `Game ${gameCode} has already finished.` });
          return;
        }

        // If game not in memory, reconstruct it
        if (!game) {
          game = await reconstructGameState(dbGame, gameCode);
          games[gameCode] = game;
        }

        // --- Reconnection / Player Matching Logic --- 
        let joiningPlayer: MemoryPlayer | undefined = undefined;
        let dbJoiningPlayer: DbPlayer | undefined = undefined;

        // 1. Try to find existing player in memory by current socket ID (fastest check)
        joiningPlayer = game.players.find(p => p.socketId === socket.id);
        if (joiningPlayer) {
          dbJoiningPlayer = dbGame.players.find(p => p.id === joiningPlayer!.id);
        }

        // 2. If not found by socket ID, try to find a player in the DB record 
        //    that doesn't have a corresponding active socket in the memory game. 
        //    This handles server restarts or players joining with a new socket ID.
        if (!joiningPlayer) {
          for (const dbP of dbGame.players) {
            const memP = game.players.find(p => p.id === dbP.id);
            // Check if this DB player is missing from memory OR if the socket ID is 'unknown' (from reconstruction)
            if (!memP || memP.socketId === 'unknown') {
              // Found a potential match - assign this player to the current socket
              dbJoiningPlayer = dbP;
              if (memP) {
                joiningPlayer = memP; // Found existing memory player needing socket update
                joiningPlayer.socketId = socket.id;
              } else {
                 // Player exists in DB but not memory (maybe due to partial reconstruction), create memory entry
                 joiningPlayer = {
                   id: dbP.id,
                   socketId: socket.id,
                   // State reconstruction should have handled ships/shots, but double-check if needed
                 };
                 game.players.push(joiningPlayer); 
              }
              break; // Found our player
            }
          }
        }

        if (joiningPlayer && dbJoiningPlayer) {
          // --- Reconnection Confirmed --- 
          joiningPlayer.socketId = socket.id; // Ensure socket ID is up-to-date
          socket.join(gameCode);
          console.log(`Player ${joiningPlayer.id} (${socket.id}) re-joined game ${gameCode}`);

          // Fetch latest full state to send back
          const latestDbGame = await prisma.game.findUnique({
            where: { id: game.dbGameId },
            include: { players: true, shots: true }
          });

          if (!latestDbGame) {
             socket.emit('error', { message: `Failed to refetch game state for ${gameCode}.` });
             return;
          }

          // Prepare full game state for the rejoining player
          const opponent = game.players.find(p => p.id !== joiningPlayer!.id);
          const dbOpponent = latestDbGame.players.find(p => p.id === opponent?.id);

          const playerShipPlacements = (dbJoiningPlayer.shipPlacements as unknown | null) as ShipPlacementData[] | null;
          const playerShipsForClient = playerShipPlacements?.map((p: ShipPlacementData) => ({ ...p })); // Ensure correct type

          const fullGameState: ClientGameState = {
            gameCode,
            playerId: joiningPlayer.id,
            opponentId: opponent?.id,
            status: latestDbGame.status as GameStatus,
            ships: playerShipsForClient, 
            isPlayerTurn: latestDbGame.currentTurnPlayerId === joiningPlayer.id,
            playerShots: latestDbGame.shots.filter((s: DbShot) => s.playerId === joiningPlayer!.id).map((s: DbShot) => ({x: s.x, y: s.y, isHit: s.isHit})),
            opponentShots: latestDbGame.shots.filter((s: DbShot) => s.playerId === opponent?.id).map((s: DbShot) => ({x: s.x, y: s.y, isHit: s.isHit})),
            winner: latestDbGame.winnerPlayerId ?? undefined,
          };

          socket.emit('game_state', fullGameState);
          return;
        } 

        // --- New Player Joining Logic --- 
        if (game.players.length >= 2) {
          socket.emit('error', { message: `Game ${gameCode} is full.` });
          return;
        }

        if (dbGame.status !== 'WAITING') { // Use DB status as source of truth
           socket.emit('error', { message: `Game ${gameCode} has already started.` });
           return;
        }

        // If we reached here, it's a valid new player joining
        const dbNewPlayer = await prisma.player.create({
          data: { gameId: dbGame.id, isHost: false }
        });

        await prisma.game.update({
          where: { id: dbGame.id },
          data: { status: 'PLACING_SHIPS' }
        });

        const newPlayer: MemoryPlayer = { id: dbNewPlayer.id, socketId: socket.id };
        game.players.push(newPlayer);
        game.status = 'placing_ships'; // Update memory status

        socket.join(gameCode);
        console.log(`🤝 Player ${newPlayer.id} (${socket.id}) joined game ${gameCode}`);

        io.to(gameCode).emit('game_state', {
          gameCode,
          status: 'placing_ships',
          players: game.players.map(p => ({ id: p.id })) // Send player IDs
        });

      } catch (error) {
        console.error(`Error joining game ${gameCode}:`, error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    socket.on('ships_placed', async ({ gameCode, ships }: { gameCode: string, ships: Ship[] }) => {
      try {
        const game = games[gameCode];
        if (!game) { socket.emit('error', { message: 'Game not found' }); return; }
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) { socket.emit('error', { message: 'Player not found in game' }); return; }
        
        // Use the imported validation function
        const placementDataForValidation = ships.map(s => ({ ...s, isPlaced: true })); 
        if (!validateShipPlacement(placementDataForValidation)) { 
          socket.emit('error', { message: 'Invalid ship placement' });
          return;
        }

        const shipPlacementsData: ShipPlacementData[] = ships.map(({ id, name, size, x, y, isVertical }) => ({ 
          id, name, size, x, y, isVertical 
        }));
        await prisma.player.update({
          where: { id: player.id },
          data: { shipPlacements: shipPlacementsData as any } // Store as JSON
        });

        player.ships = ships.map(s => ({...s, hits: 0})); // Initialize hits in memory
        player.isReady = true;

        socket.to(gameCode).emit('opponent_placed_ships');

        const allPlayersReady = game.players.length === 2 && game.players.every(p => p.isReady);
        if (allPlayersReady) {
          game.status = 'active';
          const firstPlayer = game.players[Math.random() < 0.5 ? 0 : 1];
          game.currentTurn = firstPlayer.id;

          await prisma.game.update({
            where: { id: game.dbGameId },
            data: { status: 'ACTIVE', currentTurnPlayerId: firstPlayer.id }
          });

          io.to(gameCode).emit('game_state', {
            gameCode,
            status: 'active',
            currentTurn: firstPlayer.id,
          });
        }
      } catch (error) {
        console.error('Error handling ships placement:', error);
        socket.emit('error', { message: 'Failed to process ship placement' });
      }
    });

    socket.on('fire_shot', async ({ gameCode, x, y }: { gameCode: string; x: number; y: number }) => {
      try {
        const game = games[gameCode];
        if (!game) { socket.emit('error', { message: 'Game not found' }); return; }
        const shooter = game.players.find(p => p.socketId === socket.id);
        const target = game.players.find(p => p.id !== shooter?.id);
        if (!shooter || !target) { socket.emit('error', { message: 'Players not found' }); return; }
        if (game.status !== 'active') { socket.emit('error', { message: 'Game not active' }); return; }
        if (game.currentTurn !== shooter.id) { socket.emit('error', { message: 'Not your turn' }); return; }
        if (!shooter.shots) shooter.shots = [];
        if (!target.ships) { socket.emit('error', { message: 'Target has no ships placed yet' }); return; } // Should ideally not happen if status is active

        // Validate shot coordinates and check if already taken
        if (!validateShot(x, y, shooter.shots)) {
          socket.emit('error', { message: 'Invalid shot (out of bounds or already taken)' });
          return;
        }

        // Check for hit, update hits on target ships (mutation), check for sunk/win
        const shotResult = checkShot(x, y, target.ships); // Pass target's ships

        shooter.shots.push({ x, y, isHit: shotResult.isHit });

        // Save shot to DB
        await prisma.shot.create({
          data: { x, y, isHit: shotResult.isHit, gameId: game.dbGameId, playerId: shooter.id }
        });

        socket.emit('shot_result', { x, y, isHit: shotResult.isHit });
        socket.to(gameCode).emit('opponent_shot', { x, y, isHit: shotResult.isHit });

        if (shotResult.isSunk) {
          socket.emit('ship_sunk', { shipId: shotResult.hitShipId });
          
          if (shotResult.isWin) {
            game.status = 'finished';
            await prisma.game.update({
              where: { id: game.dbGameId },
              data: { status: 'FINISHED', winnerPlayerId: shooter.id, currentTurnPlayerId: null }
            });
            io.to(gameCode).emit('game_over', { winner: shooter.id });
            // Optionally delete finished game from memory
            // delete games[gameCode]; 
            return; // Game over, no turn switch
          }
        }

        // Switch turns and save to DB
        game.currentTurn = target.id;
        await prisma.game.update({
          where: { id: game.dbGameId },
          data: { currentTurnPlayerId: target.id }
        });

      } catch (error) {
        console.error('Error handling shot:', error);
        socket.emit('error', { message: 'Failed to process shot' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      for (const gameCode in games) {
        const game = games[gameCode];
        const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const disconnectedPlayerId = game.players[playerIndex].id;
          console.log(`Player ${disconnectedPlayerId} disconnected from game ${gameCode}`);

          // Remove player from in-memory game immediately but don't end game yet
          // game.players.splice(playerIndex, 1);
          // Update player socketId to indicate disconnection?
          game.players[playerIndex].socketId = 'disconnected_' + Date.now(); 

          // Set a timeout to end the game if the player doesn't reconnect?
          // For now, we rely on the DB state being updated on the *next* action or player join.
          // We could immediately mark in DB, but that prevents rejoin. Let's try a softer approach.

          socket.to(gameCode).emit('opponent_disconnected', { disconnectedPlayerId });

          // Alternative: Mark game as finished in DB immediately on disconnect
          /*
          try {
            const dbGame = await prisma.game.findFirst({
              where: { id: game.dbGameId }
            });

            if (dbGame && dbGame.status !== 'FINISHED') {
              const winnerId = game.players.find(p => p.id !== disconnectedPlayerId)?.id;
              await prisma.game.update({
                where: { id: game.dbGameId },
                data: { status: 'FINISHED', winnerPlayerId: winnerId, currentTurnPlayerId: null }
              });
              // If marking finished, emit game_over
              if (winnerId) {
                 io.to(gameCode).emit('game_over', { winner: winnerId });
              }
              delete games[gameCode]; // Clean up memory if ending game
              console.log(`Marked game ${gameCode} as finished due to disconnect.`);
            }
          } catch (error) {
            console.error(`Error updating game status on disconnect:`, error);
          }
          */
          break;
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
