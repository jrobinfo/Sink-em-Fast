import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Ship } from './ShipPlacement';
import { motion } from 'framer-motion';

export interface Cell {
  x: number;
  y: number;
  isHit?: boolean;
  isMiss?: boolean;
  shipId?: string;
}

interface GameBoardProps {
  ships?: Ship[];
  isOpponentBoard?: boolean;
  onCellClick?: (x: number, y: number) => void;
  shots?: Cell[];
  isPlayerTurn?: boolean;
  lastShot?: Cell | null;
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROWS = Array.from({ length: 10 }, (_, i) => i + 1);

export function GameBoard({
  ships = [],
  isOpponentBoard = false,
  onCellClick,
  shots = [],
  isPlayerTurn = false,
  lastShot = null,
}: GameBoardProps) {
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  // Check if a cell contains a ship
  const getCellContent = (x: number, y: number): Cell => {
    // First check if there's a shot at this position
    const shot = shots.find(s => s.x === x && s.y === y);
    if (shot) {
      return shot;
    }

    // If it's the opponent's board and no shot, just return empty cell
    if (isOpponentBoard) {
      return { x, y };
    }

    // Check if there's a ship at this position
    for (const ship of ships) {
      if (!ship.position) continue;
      
      for (let i = 0; i < ship.size; i++) {
        const shipX = ship.isVertical ? ship.position.x : ship.position.x + i;
        const shipY = ship.isVertical ? ship.position.y + i : ship.position.y;
        
        if (shipX === x && shipY === y) {
          return { x, y, shipId: ship.id };
        }
      }
    }

    return { x, y };
  };

  const handleCellClick = (x: number, y: number) => {
    if (!isOpponentBoard || !isPlayerTurn || !onCellClick) return;
    
    // Check if cell was already shot
    const isAlreadyShot = shots.some(shot => shot.x === x && shot.y === y);
    if (isAlreadyShot) return;

    onCellClick(x, y);
  };

  const cellVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { duration: 0.3 } },
    hit: { scale: [1, 1.2, 1], backgroundColor: "#ef4444", transition: { duration: 0.5 } },
    miss: { scale: [1, 1.1, 1], backgroundColor: "#e5e7eb", transition: { duration: 0.5 } },
  };

  return (
    <div className="relative">
      {/* Column Labels */}
      <div className="flex ml-8">
        {COLS.map(col => (
          <div key={col} className="w-10 h-8 flex items-center justify-center font-semibold">
            {col}
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Row Labels */}
        <div className="flex flex-col w-8">
          {ROWS.map(row => (
            <div key={row} className="h-10 flex items-center justify-center font-semibold">
              {row}
            </div>
          ))}
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-10 gap-0 border border-gray-400">
          {Array.from({ length: 100 }).map((_, i) => {
            const x = i % 10;
            const y = Math.floor(i / 10);
            const cell = getCellContent(x, y);
            const isHovered = hoverCell?.x === x && hoverCell?.y === y;
            const isLastShot = lastShot && lastShot.x === x && lastShot.y === y;

            return (
              <motion.div
                key={`${x}-${y}`}
                data-testid={`cell-${x}-${y}`}
                className={cn(
                  "w-10 h-10 border border-gray-300 transition-colors",
                  cell.shipId && !isOpponentBoard && "bg-blue-500",
                  isOpponentBoard && isPlayerTurn && !cell.isHit && !cell.isMiss && "cursor-pointer hover:bg-gray-100",
                  isHovered && isOpponentBoard && isPlayerTurn && !cell.isHit && !cell.isMiss && "bg-gray-200"
                )}
                onClick={() => handleCellClick(x, y)}
                onMouseEnter={() => setHoverCell({ x, y })}
                onMouseLeave={() => setHoverCell(null)}
                variants={cellVariants}
                initial="hidden"
                animate={isLastShot ? (cell.isHit ? 'hit' : 'miss') : 'visible'}
                style={{ backgroundColor: cell.isHit ? '#ef4444' : cell.isMiss ? '#e5e7eb' : undefined }}
              >
                {cell.isHit && (
                  <motion.div 
                    className="w-full h-full flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    <div className="w-3 h-3 bg-red-600 rounded-full" />
                  </motion.div>
                )}
                {cell.isMiss && (
                  <motion.div 
                    className="w-full h-full flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  >
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Turn Indicator */}
      {isOpponentBoard && (
        <div 
          data-testid="turn-indicator"
          className={cn(
          "absolute -top-8 left-0 right-0 text-center font-semibold",
          isPlayerTurn ? "text-green-600" : "text-gray-500"
        )}>
          {isPlayerTurn ? "Your turn - Take a shot!" : "Opponent's turn"}
        </div>
      )}
    </div>
  );
} 