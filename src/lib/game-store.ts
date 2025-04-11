// src/lib/game-store.ts

export interface Game {
  gameCode: string;
  players: { id: string; name?: string }[]; // Store player objects with IDs
  status: 'waiting' | 'placing_ships' | 'active' | 'finished';
  // Add more game state properties here later (grids, turn, etc.)
}

// Simple in-memory store for games
// Warning: This will reset every time the server restarts!
const games: Record<string, Game> = {};

export const gameStore = {
  addGame: (game: Game) => {
    games[game.gameCode] = game;
  },
  getGame: (gameCode: string): Game | undefined => {
    return games[gameCode];
  },
  updateGame: (gameCode: string, updatedGame: Partial<Game>) => {
    if (games[gameCode]) {
      games[gameCode] = { ...games[gameCode], ...updatedGame };
    }
  },
  getAllGames: () => { // For debugging
      return games;
  },
  findWaitingGame: (): string | null => { // Helper for joining random games later
    for (const code in games) {
      if (games[code].status === 'waiting' && games[code].players.length < 2) {
        return code;
      }
    }
    return null;
  }
};

// Function to generate a unique game code
export const generateGameCode = (): string => {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (gameStore.getGame(code)); // Ensure code is unique using the store
  return code;
};

// Function to generate a unique player ID
export const generatePlayerId = (): string => {
  return `player_${Math.random().toString(36).substring(2, 9)}`;
};
