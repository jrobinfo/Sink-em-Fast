"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { useRouter } from 'next/navigation'; // Import useRouter for navigation

// Define expected socket event payloads (optional but good practice)
interface GameCreatedPayload {
  gameCode: string;
  playerId: string;
}

interface GameJoinedPayload {
    gameCode: string;
    playerId: string;
    opponentId?: string; // Opponent might not exist yet
    gameStatus: string;
}

interface PlayerJoinedPayload {
    opponentId: string;
    gameStatus: string;
}

interface ErrorPayload {
  message: string;
}

export default function Home() {
  const [gameCodeInput, setGameCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  // --- Socket Connection Handler ---
  useEffect(() => {
    // Establish socket connection when component mounts
    // Assumes server is running on the same host/port
    // Adjust URL if your server is elsewhere (e.g., process.env.NEXT_PUBLIC_SOCKET_URL)
    const newSocket = io(); // Defaults to window.location

    newSocket.on("connect", () => {
      console.log("🔌 Socket connected:", newSocket.id);
      setSocket(newSocket);
    });

    newSocket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
      toast({ title: "Disconnected", description: "Connection lost. Please refresh.", variant: "destructive" });
      setSocket(null);
      setIsLoading(false); // Reset loading state on disconnect
      setPlayerId(null);
    });

    newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        toast({ title: "Connection Error", description: "Could not connect to the server. Please try again later.", variant: "destructive" });
        setIsLoading(false);
    });

    // --- Game Event Listeners ---
    newSocket.on("game_created", ({ gameCode, playerId }: GameCreatedPayload) => {
      console.log("Event: game_created", { gameCode, playerId });
      setGameCodeInput(gameCode); // Show the generated code in the input
      setPlayerId(playerId);
      setIsLoading(false);
      toast({ title: "Game Created!", description: `Waiting for opponent... Code: ${gameCode}` });
      // Don't navigate yet, wait for opponent
    });

    newSocket.on("game_joined", ({ gameCode, playerId: joinedPlayerId, opponentId, gameStatus }: GameJoinedPayload) => {
        console.log("Event: game_joined", { gameCode, joinedPlayerId, opponentId, gameStatus });
        setPlayerId(joinedPlayerId); // Store our player ID
        setIsLoading(false);
        toast({ title: "Joined Game!", description: `Successfully joined game ${gameCode}. ${opponentId ? 'Opponent found!' : 'Waiting for opponent...'} ` });
        // Navigate to game page immediately if opponent exists (creator)
        if (opponentId) {
            router.push(`/game/${gameCode}`);
        }
    });

    newSocket.on("player_joined", ({ opponentId, gameStatus }: PlayerJoinedPayload) => {
        console.log("Event: player_joined", { opponentId, gameStatus });
        setIsLoading(false); // Opponent joined, no longer loading/waiting strictly here
        toast({ title: "Opponent Joined!", description: `Player ${opponentId} joined the game. Starting soon...` });
        // Creator navigates when the second player joins
        // Need the gameCode here - ideally get it from component state
        // This assumes gameCodeInput holds the code the creator generated
        if (gameCodeInput) {
             router.push(`/game/${gameCodeInput}`);
        } else {
             console.error("Game code not available on player_joined event for creator");
             // Might need to fetch gameCode from state if not in input
        }
    });

    newSocket.on("error", ({ message }: ErrorPayload) => {
      console.error("Socket Error Received:", message);
      toast({ title: "Error", description: message, variant: "destructive" });
      setIsLoading(false); // Stop loading on error
    });

    // Cleanup function to disconnect socket when component unmounts
    return () => {
      console.log("🔌 Disconnecting socket...");
      newSocket.disconnect();
    };
  }, [toast, router, gameCodeInput]); // Add gameCodeInput dependency for use in player_joined

  // --- Button Click Handlers ---
  const handleGenerateCode = useCallback(() => {
    if (!socket || isLoading) return;
    console.log("Requesting: create_game");
    setIsLoading(true);
    socket.emit("create_game");
  }, [socket, isLoading]);

  const handleJoinGame = useCallback(() => {
    if (!socket || isLoading || !gameCodeInput) {
         if (!gameCodeInput) toast({ title: "Missing Code", description: "Please enter a game code.", variant: "destructive" });
        return;
    }
    console.log(`Requesting: join_game with code ${gameCodeInput}`);
    setIsLoading(true);
    socket.emit("join_game", { gameCode: gameCodeInput });
  }, [socket, isLoading, gameCodeInput, toast]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <h1 className="text-4xl font-bold mb-8 text-foreground">Sink 'Em Fast</h1>

      {!socket && (
          <p className="text-destructive font-semibold mb-4">Connecting to server...</p>
      )}

      <div className="flex flex-col items-center space-y-4 w-full max-w-md">
        <div className="flex items-center space-x-2 w-full">
          <Input
            type="text"
            placeholder="Enter Game Code"
            value={gameCodeInput}
            onChange={(e) => setGameCodeInput(e.target.value.toUpperCase())}
            className="w-full"
            disabled={isLoading || !socket} // Disable if loading or not connected
          />
          <Button
             onClick={handleJoinGame}
             className="bg-primary text-primary-foreground hover:bg-primary/80 whitespace-nowrap"
             disabled={isLoading || !socket || !gameCodeInput} // Disable if loading, not connected, or no code
           >
            Join Game
          </Button>
        </div>

         <p className="text-sm text-muted-foreground">Or</p>

        <Button
           variant="outline"
           onClick={handleGenerateCode}
           className="w-full"
           disabled={isLoading || !socket} // Disable if loading or not connected
         >
           {isLoading ? 'Processing...' : 'Generate New Game Code'}
        </Button>
      </div>
       {/* Toaster is in layout.tsx */} 
    </div>
  );
}
