import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateShipPlacement, checkShot, validateShot, GRID_SIZE } from './game-logic';
import type { Ship, Shot } from './types';

// Helper to create a ship object easily
const createShip = (id: string, size: number, x: number, y: number, isVertical: boolean): Ship => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  size,
  x,
  y,
  isVertical,
  isPlaced: true, // Assume placed for validation tests
  hits: 0, // Start with 0 hits
});

describe('validateShipPlacement', () => {
  it('should return true for valid, non-overlapping horizontal placements', () => {
    const ships = [
      createShip('destroyer', 2, 0, 0, false),
      createShip('submarine', 3, 0, 1, false),
      createShip('carrier', 5, 0, 9, false),
    ];
    expect(validateShipPlacement(ships)).toBe(true);
  });

  it('should return true for valid, non-overlapping vertical placements', () => {
    const ships = [
      createShip('destroyer', 2, 0, 0, true),
      createShip('submarine', 3, 1, 0, true),
      createShip('carrier', 5, 9, 0, true),
    ];
    expect(validateShipPlacement(ships)).toBe(true);
  });

  it('should return true for valid, non-overlapping mixed placements', () => {
    const ships = [
      createShip('destroyer', 2, 0, 0, false),
      createShip('submarine', 3, 0, 1, true),
      createShip('carrier', 5, 5, 5, false),
      createShip('battleship', 4, 9, 0, true),
    ];
    expect(validateShipPlacement(ships)).toBe(true);
  });

  it('should return false if ships overlap horizontally', () => {
    const ships = [
      createShip('destroyer', 2, 0, 0, false),
      createShip('submarine', 3, 1, 0, false), // Overlaps destroyer at (1,0)
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });

  it('should return false if ships overlap vertically', () => {
    const ships = [
      createShip('destroyer', 2, 0, 0, true),
      createShip('submarine', 3, 0, 1, true), // Overlaps destroyer at (0,1)
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });

  it('should return false if ships overlap diagonally (corner touch)', () => {
    // This setup should fail because (1,1) is occupied by both
    const ships = [
      createShip('destroyer', 2, 0, 1, false), // 0,1 and 1,1
      createShip('submarine', 3, 1, 0, true),  // 1,0 and 1,1 and 1,2
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });

  it('should return false if a ship is placed out of bounds (horizontal)', () => {
    const ships = [
      createShip('carrier', 5, 8, 0, false), // Goes off grid at x=10, x=11, x=12
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });

  it('should return false if a ship is placed out of bounds (vertical)', () => {
    const ships = [
      createShip('carrier', 5, 0, 8, true), // Goes off grid at y=10, y=11, y=12
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });
  
  it('should return false if a ship starts out of bounds', () => {
    const ships = [
      createShip('destroyer', 2, 10, 0, false), 
    ];
    expect(validateShipPlacement(ships)).toBe(false);
  });
  
  it('should return false if ships have missing coordinates', () => {
    const ships: any[] = [
      { id: 'carrier', name: 'Carrier', size: 5, isVertical: false, isPlaced: true }, // Missing x, y
      createShip('destroyer', 2, 0, 0, false),
    ];
    // Suppress console.error for this specific test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(validateShipPlacement(ships as Ship[])).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('should handle an empty array of ships', () => {
    const ships: Ship[] = [];
    expect(validateShipPlacement(ships)).toBe(true);
  });

  it('should handle edge placements correctly', () => {
    const ships = [
      createShip('destroyer', 2, 8, 9, false), // 8,9 and 9,9
      createShip('submarine', 3, 0, 0, true),  // 0,0 and 0,1 and 0,2
      createShip('carrier', 5, 9, 0, true),   // 9,0 to 9,4
    ];
    expect(validateShipPlacement(ships)).toBe(true);
  });
});

describe('validateShot', () => {
  const existingShots: Shot[] = [
    { x: 0, y: 0, isHit: true },
    { x: 5, y: 5, isHit: false },
  ];

  it('should return true for a valid shot within bounds and not previously taken', () => {
    expect(validateShot(1, 1, existingShots)).toBe(true);
    expect(validateShot(9, 9, existingShots)).toBe(true);
  });

  it('should return false for a shot out of bounds (negative coords)', () => {
    expect(validateShot(-1, 5, existingShots)).toBe(false);
    expect(validateShot(5, -1, existingShots)).toBe(false);
  });

  it('should return false for a shot out of bounds (exceeding grid size)', () => {
    expect(validateShot(GRID_SIZE, 5, existingShots)).toBe(false);
    expect(validateShot(5, GRID_SIZE, existingShots)).toBe(false);
  });

  it('should return false for a shot at a previously taken coordinate', () => {
    expect(validateShot(0, 0, existingShots)).toBe(false);
    expect(validateShot(5, 5, existingShots)).toBe(false);
  });

  it('should return true for a valid shot with an empty list of existing shots', () => {
    expect(validateShot(3, 4, [])).toBe(true);
  });
});

describe('checkShot', () => {
  let targetShips: Ship[];

  beforeEach(() => {
    // Reset ships before each test to avoid mutation side effects
    targetShips = [
      createShip('destroyer', 2, 0, 0, false), // (0,0), (1,0)
      createShip('submarine', 3, 2, 2, true),  // (2,2), (2,3), (2,4)
    ];
  });

  it('should return isHit: true and hitShipId when hitting a ship', () => {
    const result = checkShot(1, 0, targetShips);
    expect(result.isHit).toBe(true);
    expect(result.hitShipId).toBe('destroyer');
    expect(result.isSunk).toBe(false);
    expect(result.isWin).toBe(false);
    // Verify mutation
    expect(targetShips.find(s => s.id === 'destroyer')?.hits).toBe(1);
  });

  it('should return isHit: false when missing all ships', () => {
    const result = checkShot(5, 5, targetShips);
    expect(result.isHit).toBe(false);
    expect(result.hitShipId).toBeUndefined();
    expect(result.isSunk).toBe(false);
    expect(result.isWin).toBe(false);
    expect(targetShips.find(s => s.id === 'destroyer')?.hits).toBe(0);
    expect(targetShips.find(s => s.id === 'submarine')?.hits).toBe(0);
  });

  it('should return isSunk: true when the last part of a ship is hit', () => {
    checkShot(0, 0, targetShips); // Hit 1
    const result = checkShot(1, 0, targetShips); // Hit 2 (sinks destroyer)
    expect(result.isHit).toBe(true);
    expect(result.hitShipId).toBe('destroyer');
    expect(result.isSunk).toBe(true);
    expect(result.isWin).toBe(false);
    expect(targetShips.find(s => s.id === 'destroyer')?.hits).toBe(2);
  });

  it('should return isWin: true when the last hit sinks the last ship', () => {
    // Sink destroyer
    checkShot(0, 0, targetShips);
    checkShot(1, 0, targetShips);
    // Sink submarine
    checkShot(2, 2, targetShips);
    checkShot(2, 3, targetShips);
    const result = checkShot(2, 4, targetShips); // Last hit
    
    expect(result.isHit).toBe(true);
    expect(result.hitShipId).toBe('submarine');
    expect(result.isSunk).toBe(true);
    expect(result.isWin).toBe(true);
    expect(targetShips.find(s => s.id === 'submarine')?.hits).toBe(3);
  });

  it('should not count multiple hits on the same spot towards sinking', () => {
    checkShot(0, 0, targetShips); // Hit 1
    checkShot(0, 0, targetShips); // Hit same spot again
    const result = checkShot(1, 0, targetShips); // Hit 2 (should sink)
    expect(result.isSunk).toBe(true);
    expect(targetShips.find(s => s.id === 'destroyer')?.hits).toBe(3); // Hits incremented, but size check determines sunk
  });

   it('should handle checking shots against an empty fleet', () => {
    const result = checkShot(0, 0, []);
    expect(result.isHit).toBe(false);
    expect(result.isSunk).toBe(false);
    expect(result.isWin).toBe(false);
  });
}); 