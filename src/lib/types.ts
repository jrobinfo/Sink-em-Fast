// src/lib/types.ts
import type { Game as DbGame, Player as DbPlayer, Shot as DbShot } from '@prisma/client';

// Data structure for ship placement as stored in DB (JSON)
export interface ShipPlacementData {
  id: string;
  name: string;
  size: number;
  x: number;
  y: number;
  isVertical: boolean;
}

// Type for in-memory ship representation (used in server and potentially client)
export interface Ship extends ShipPlacementData {
  isPlaced: boolean;
  hits?: number;
}

// Type for representing a cell state (client-side)
export interface Cell {
  x: number;
  y: number;
  isHit?: boolean;
  isMiss?: boolean;
  shipId?: string; // ID of the ship occupying the cell (if any)
}

// Type for representing a shot (used in memory and potentially client)
export interface Shot {
  x: number;
  y: number;
  isHit: boolean;
}

// Type for in-memory player representation (server-side)
export interface MemoryPlayer {
  id: string;
  socketId: string;
  ships?: Ship[]; // Ships with hit count
  isReady?: boolean;
  shots?: Shot[]; // Shots made by this player
}

// Type for game status (shared)
export type GameStatus = 'waiting' | 'placing_ships' | 'active' | 'finished';

// Type for in-memory game representation (server-side)
export interface Game {
  gameCode: string;
  dbGameId: string;
  players: MemoryPlayer[];
  status: GameStatus;
  currentTurn?: string; // player ID whose turn it is
}

// Type for the fully loaded DbGame including relations needed for reconstruction
export type FullDbGame = DbGame & { 
  players: (DbPlayer & { /* shipPlacements is implicitly included */ })[];
  shots: DbShot[];
};

// Type for GameState sent to client
export interface ClientGameState {
  gameCode: string;
  playerId: string;
  opponentId?: string;
  status: GameStatus;
  ships?: ShipPlacementData[]; // Send placement data, not full Ship objects with hits
  isPlayerTurn?: boolean;
  playerShots: Shot[];
  opponentShots: Shot[];
  winner?: string;
} 