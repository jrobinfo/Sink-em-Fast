'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ShipPlacement, type Ship } from '@/components/game/ShipPlacement';
import { GameBoard, type Cell } from '@/components/game/GameBoard';
import { useToast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { Howl } from 'howler';

type GameStatus = 'waiting' | 'placing_ships' | 'active' | 'finished';

interface GameState {
  gameCode: string;
  playerId: string;
  opponentId?: string;
  status: GameStatus;
  ships?: Ship[];
  isPlayerTurn?: boolean;
  playerShots: Cell[];
  opponentShots: Cell[];
  winner?: string;
}

export default function GamePage() {
  const params = useParams();
  const gameCode = params.code as string;
  const { toast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    gameCode,
    playerId: '',
    status: 'waiting',
    playerShots: [],
    opponentShots: [],
  });
  const [lastPlayerShot, setLastPlayerShot] = useState<Cell | null>(null);
  const [lastOpponentShot, setLastOpponentShot] = useState<Cell | null>(null);

  // Initialize sounds
  const sounds = useMemo(() => {
    if (typeof window === 'undefined') return {}; // Don't run on server
    return {
      shot: new Howl({
        src: ['/sounds/shot.mp3'],
        volume: 0.5,
      }),
      hit: new Howl({
        src: ['/sounds/hit.mp3'],
        volume: 0.7,
      }),
      miss: new Howl({
        src: ['/sounds/miss.mp3'],
        volume: 0.4,
      }),
      sunk: new Howl({
        src: ['/sounds/sunk.mp3'],
        volume: 0.8,
      }),
      win: new Howl({
        src: ['/sounds/win.mp3'],
        volume: 0.9,
      }),
      lose: new Howl({
        src: ['/sounds/lose.mp3'],
        volume: 0.9,
      }),
    };
  }, []);

  const playSound = (soundName: keyof typeof sounds) => {
    const sound = sounds[soundName];
    if (sound && sound instanceof Howl) {
      sound.play();
    }
  };

  useEffect(() => {
    const newSocket = io();

    newSocket.on('connect', () => {
      console.log('🔌 Connected to game socket');
      setSocket(newSocket);
    });

    newSocket.on('game_state', (state: GameState) => {
      console.log('Received game state:', state);
      setGameState(state);
      // Reset last shots when game state changes significantly (e.g., game start)
      setLastPlayerShot(null);
      setLastOpponentShot(null);
    });

    newSocket.on('opponent_placed_ships', () => {
      toast({
        title: 'Opponent Ready!',
        description: 'Your opponent has placed their ships.',
      });
    });

    newSocket.on('game_start', () => {
      toast({
        title: 'Game Starting!',
        description: 'Both players are ready. The game will begin!',
      });
      setGameState(prev => ({ ...prev, status: 'active' }));
    });

    newSocket.on('shot_result', ({ x, y, isHit }: { x: number; y: number; isHit: boolean }) => {
      const newShot = { x, y, isHit: isHit, isMiss: !isHit };
      setGameState(prev => ({
        ...prev,
        playerShots: [...prev.playerShots, newShot],
        isPlayerTurn: false,
      }));
      setLastPlayerShot(newShot);
      setLastOpponentShot(null); // Clear opponent's last shot visual

      playSound(isHit ? 'hit' : 'miss');

      toast({
        title: isHit ? 'Direct Hit!' : 'Miss!',
        description: isHit ? 'You hit an enemy ship!' : 'Your shot missed.',
        variant: isHit ? 'default' : 'destructive',
      });
    });

    newSocket.on('opponent_shot', ({ x, y, isHit }: { x: number; y: number; isHit: boolean }) => {
      const newShot = { x, y, isHit: isHit, isMiss: !isHit };
      setGameState(prev => ({
        ...prev,
        opponentShots: [...prev.opponentShots, newShot],
        isPlayerTurn: true,
      }));
      setLastOpponentShot(newShot);
      setLastPlayerShot(null); // Clear player's last shot visual
      
      playSound(isHit ? 'hit' : 'miss');

      toast({
        title: isHit ? 'Ship Hit!' : 'They Missed!',
        description: isHit ? 'The enemy hit your ship!' : 'The enemy shot missed.',
        variant: isHit ? 'destructive' : 'default',
      });
    });

    newSocket.on('ship_sunk', ({ shipId }: { shipId: string }) => {
      playSound('sunk');
      toast({
        title: 'Ship Sunk!',
        description: 'You sunk an enemy ship!',
      });
    });

    newSocket.on('game_over', ({ winner }: { winner: string }) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner,
      }));

      playSound(winner === gameState.playerId ? 'win' : 'lose');

      toast({
        title: winner === gameState.playerId ? 'Victory!' : 'Defeat!',
        description: winner === gameState.playerId
          ? 'You sunk all enemy ships!'
          : 'All your ships have been sunk!',
        variant: winner === gameState.playerId ? 'default' : 'destructive',
      });
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    });

    return () => {
      console.log('🔌 Disconnecting game socket');
      newSocket.disconnect();
    };
  }, [toast, gameState.playerId, gameCode, sounds]);

  const handleShipPlacement = (ships: Ship[]) => {
    if (!socket) return;

    socket.emit('ships_placed', {
      gameCode,
      ships,
    });

    toast({
      title: 'Ships Placed!',
      description: 'Waiting for opponent...',
    });

    setGameState(prev => ({
      ...prev,
      ships,
    }));
  };

  const handleShot = (x: number, y: number) => {
    if (!socket || !gameState.isPlayerTurn) return;

    playSound('shot');

    socket.emit('fire_shot', {
      gameCode,
      x,
      y,
    });
  };

  if (!socket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Connecting to game...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Game {gameCode}</h1>

      {gameState.status === 'placing_ships' && !gameState.ships && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Place Your Ships</h2>
          <ShipPlacement onPlacementComplete={handleShipPlacement} />
        </div>
      )}

      {gameState.status === 'placing_ships' && gameState.ships && (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">Waiting for Opponent</h2>
          <p className="text-gray-600">Your opponent is placing their ships...</p>
        </div>
      )}

      {gameState.status === 'active' && (
        <div className="flex flex-col items-center gap-16">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Enemy Waters</h2>
            <GameBoard
              isOpponentBoard
              shots={gameState.playerShots}
              isPlayerTurn={gameState.isPlayerTurn}
              onCellClick={handleShot}
              lastShot={lastPlayerShot}
            />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Your Fleet</h2>
            <GameBoard
              ships={gameState.ships}
              shots={gameState.opponentShots}
              lastShot={lastOpponentShot}
            />
          </div>
        </div>
      )}

      {gameState.status === 'finished' && (
        <div className="text-center py-12">
          <h2 className="text-4xl font-bold mb-4">
            {gameState.winner === gameState.playerId ? 'Victory!' : 'Defeat!'}
          </h2>
          <p className="text-xl text-gray-600">
            {gameState.winner === gameState.playerId
              ? 'You sunk all enemy ships!'
              : 'All your ships have been sunk!'}
          </p>
        </div>
      )}
    </div>
  );
} 