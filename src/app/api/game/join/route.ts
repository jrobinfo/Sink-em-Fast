// src/app/api/game/join/route.ts
import { NextResponse } from 'next/server';
import { gameStore, generatePlayerId } from '@/lib/game-store';

export async function POST(request: Request) {
  try {
    const { gameCode } = await request.json();

    if (!gameCode) {
      return NextResponse.json({ message: 'Game code is required' }, { status: 400 });
    }

    const game = gameStore.getGame(gameCode);

    if (!game) {
      return NextResponse.json({ message: 'Game not found' }, { status: 404 });
    }

    if (game.players.length >= 2) {
      return NextResponse.json({ message: 'Game is full' }, { status: 409 }); // 409 Conflict
    }

    // Check if joining player is already in the game (e.g., creator refreshing)
    // We need the player's ID from the client for this check. Let's assume it's passed.
    // **Modify this later if needed**
    // const { playerId: joiningPlayerId } = await request.json();
    // if (game.players.some(p => p.id === joiningPlayerId)) {
    //    console.log(`Player ${joiningPlayerId} rejoining game ${gameCode}`);
    //    return NextResponse.json({ gameCode, playerId: joiningPlayerId, message: "Rejoined game" });
    // }

    const newPlayerId = generatePlayerId();
    const updatedPlayers = [...game.players, { id: newPlayerId }];

    // Update game status when the second player joins
    const updatedStatus = updatedPlayers.length === 2 ? 'placing_ships' : game.status;

    gameStore.updateGame(gameCode, { players: updatedPlayers, status: updatedStatus });

    console.log(`Player ${newPlayerId} joined game: ${gameCode}`, gameStore.getGame(gameCode));

    // TODO: Notify the first player via WebSocket that someone joined

    // Return the game code and the new player's ID
    return NextResponse.json({ gameCode, playerId: newPlayerId });

  } catch (error) {
    console.error("Error joining game:", error);
    // Check if the error is due to invalid JSON body
    if (error instanceof SyntaxError) {
        return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error joining game' }, { status: 500 });
  }
}
