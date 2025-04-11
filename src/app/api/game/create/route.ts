// src/app/api/game/create/route.ts
import { NextResponse } from 'next/server';
import { gameStore, generateGameCode, generatePlayerId, type Game } from '@/lib/game-store';

export async function POST() {
  try {
    const gameCode = generateGameCode();
    const playerId = generatePlayerId();

    const newGame: Game = {
      gameCode: gameCode,
      players: [{ id: playerId }], // Store player as an object with ID
      status: 'waiting',
    };

    gameStore.addGame(newGame);

    console.log(`Game created: ${gameCode}`, newGame);

    // Return the game code and the player's ID for this session
    return NextResponse.json({ gameCode, playerId });

  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json({ message: 'Error creating game' }, { status: 500 });
  }
}

// Temporary GET handler to view games (for debugging)
export async function GET() {
    return NextResponse.json(gameStore.getAllGames());
}
