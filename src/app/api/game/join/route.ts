// src/app/api/game/join/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const joinGameSchema = z.object({
  gameCode: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { gameCode } = joinGameSchema.parse(body);

    // Check if game exists
    const game = await db.game.findUnique({
      where: {
        code: gameCode,
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.status !== 'WAITING') {
      return NextResponse.json(
        { error: 'Game has already started' },
        { status: 400 }
      );
    }

    // Create a new player for this game
    const player = await db.player.create({
      data: {
        gameId: game.id,
        isHost: false,
      },
    });

    return NextResponse.json({
      playerId: player.id,
      gameId: game.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid game code format' },
        { status: 400 }
      );
    }
    
    console.error('Error joining game:', error);
    return NextResponse.json(
      { error: 'Failed to join game' },
      { status: 500 }
    );
  }
}
