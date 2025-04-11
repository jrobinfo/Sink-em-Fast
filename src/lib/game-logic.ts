import { Ship, Shot } from '@/lib/types';

export const GRID_SIZE = 10;

export function validateShipPlacement(ships: Ship[]): boolean {
  // Ensure all ships have coordinates before validation
  if (!ships.every(ship => typeof ship.x === 'number' && typeof ship.y === 'number')) {
    console.error("Validation Error: Some ships lack coordinates.");
    return false;
  }

  const occupiedCells = new Set<string>();

  for (const ship of ships) {
    for (let i = 0; i < ship.size; i++) {
      const currentX = ship.isVertical ? ship.x : ship.x + i;
      const currentY = ship.isVertical ? ship.y + i : ship.y;

      // Check bounds
      if (currentX < 0 || currentX >= GRID_SIZE || currentY < 0 || currentY >= GRID_SIZE) {
        console.error(`Validation Error: Ship "${ship.name}" out of bounds at (${currentX}, ${currentY})`);
        return false;
      }

      const cellKey = `${currentX},${currentY}`;
      if (occupiedCells.has(cellKey)) {
         console.error(`Validation Error: Ships overlap at (${currentX}, ${currentY})`);
        return false;
      }
      occupiedCells.add(cellKey);
    }
  }
  return true;
}

export interface ProcessShotResult {
  isHit: boolean;
  hitShipId?: string;
  isSunk?: boolean;
  isWin?: boolean;
}

/**
 * Checks if a shot hits any ship in the target's fleet.
 * Mutates the targetShips array by incrementing hits on the hit ship.
 */
export function checkShot(x: number, y: number, targetShips: Ship[]): ProcessShotResult {
  let hitShip: Ship | undefined;
  
  for (const ship of targetShips) {
    for (let i = 0; i < ship.size; i++) {
      const shipX = ship.isVertical ? ship.x : ship.x + i;
      const shipY = ship.isVertical ? ship.y : ship.y + i;
      
      if (shipX === x && shipY === y) {
        hitShip = ship;
        if (!ship.hits) ship.hits = 0;
        ship.hits++; // Mutate the ship object to record the hit
        break;
      }
    }
    if (hitShip) break;
  }

  const isHit = !!hitShip;
  // Only check sunk/win if it was a hit and the ship exists
  const isSunk = hitShip ? hitShip.hits === hitShip.size : false;
  const isWin = isSunk ? targetShips.every(ship => (ship.hits ?? 0) >= ship.size) : false;

  return {
    isHit,
    hitShipId: hitShip?.id, // Optional chaining handles undefined
    isSunk,
    isWin,
  };
}

/**
 * Validates if a shot is valid (within bounds and not already taken).
 */
export function validateShot(x: number, y: number, existingShots: Shot[]): boolean {
  // Check bounds
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
    return false;
  }
  
  // Check if already shot
  if (existingShots.some(shot => shot.x === x && shot.y === y)) {
    return false;
  }
  
  return true;
}

// Placeholder for other game logic functions
// export function calculateHits(...) {}
// export function checkWinCondition(...) {} 