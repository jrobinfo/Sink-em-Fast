"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Home() {
  const [gameCode, setGameCode] = useState("");

  const handleGenerateCode = () => {
    // Logic to generate game code
    const newGameCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setGameCode(newGameCode);
  };

  const handleJoinGame = () => {
    // Logic to join game
    if (gameCode) {
      console.log("Joining game with code:", gameCode);
      // Redirect user to game page with the game code.
    } else {
      console.log("Joining random game.");
      // Redirect user to a random game.
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <h1 className="text-4xl font-bold mb-8 text-foreground">Sink 'Em Fast</h1>

      <div className="flex flex-col items-center space-y-4 w-full max-w-md">
        <div className="flex items-center space-x-2 w-full">
          <Input
            type="text"
            placeholder="Enter Game Code"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value)}
            className="w-full"
          />
          <Button onClick={handleJoinGame} className="bg-primary text-primary-foreground hover:bg-primary/80">
            Join Game
          </Button>
        </div>

        <Button variant="outline" onClick={handleGenerateCode} className="w-full">
          Generate Game Code
        </Button>
      </div>
    </div>
  );
}
