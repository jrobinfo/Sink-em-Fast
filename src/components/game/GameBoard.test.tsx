import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GameBoard } from './GameBoard';
import type { Ship, Cell } from '@/lib/types';

// Helper to create mock ships
const createMockShip = (id: string, size: number, x: number, y: number, isVertical: boolean): Ship => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  size,
  x,
  y,
  isVertical,
  isPlaced: true,
  hits: 0,
});

describe('<GameBoard />', () => {
  const mockShips: Ship[] = [
    createMockShip('destroyer', 2, 0, 0, false), // A1, B1
  ];
  const mockPlayerShots: Cell[] = [
    { x: 5, y: 5, isHit: true, shipId: 'battleship' }, // F6 Hit
    { x: 9, y: 0, isMiss: true },                // J1 Miss
  ];
  const mockOpponentShots: Cell[] = [
    { x: 0, y: 0, isHit: true, shipId: 'destroyer' }, // A1 Hit on player
    { x: 4, y: 4, isMiss: true },                 // E5 Miss on player
  ];

  it('renders grid labels correctly', () => {
    render(<GameBoard />);
    // Check for column labels
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
    // Check for row labels
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    // Check for total cells (100) + labels (20) - might be brittle, check main grid exists
    expect(screen.getAllByRole('gridcell', { hidden: true }).length).toBe(100);
  });

  it('renders player ships on player board', () => {
    render(<GameBoard ships={mockShips} shots={mockOpponentShots} />);
    const cellA1 = screen.getByTestId('cell-0-0'); // Add data-testid in component if needed
    const cellB1 = screen.getByTestId('cell-1-0');
    const cellC1 = screen.getByTestId('cell-2-0');

    // Expect ship cells to have ship styling (check class or data attribute)
    // A1 is hit
    expect(cellA1).toHaveClass('bg-red-500'); 
    // B1 is part of ship, not hit
    expect(cellB1).toHaveClass('bg-blue-500');
    // C1 is empty water
    expect(cellC1).not.toHaveClass('bg-blue-500');
    expect(cellC1).not.toHaveClass('bg-red-500'); 
  });

  it('renders hits and misses on opponent board', () => {
    render(<GameBoard isOpponentBoard={true} shots={mockPlayerShots} />);
    const cellF6 = screen.getByTestId('cell-5-5'); // Hit
    const cellJ1 = screen.getByTestId('cell-9-0'); // Miss
    const cellA1 = screen.getByTestId('cell-0-0'); // Empty

    expect(cellF6).toHaveClass('bg-red-500');
    expect(cellJ1).toHaveClass('bg-gray-200');
    expect(cellA1).not.toHaveClass('bg-red-500');
    expect(cellA1).not.toHaveClass('bg-gray-200');
  });

  it('calls onCellClick when clicking valid cell on opponent board during player turn', () => {
    const handleClick = vi.fn();
    render(
      <GameBoard
        isOpponentBoard={true}
        shots={mockPlayerShots}
        isPlayerTurn={true}
        onCellClick={handleClick}
      />
    );
    const cellA2 = screen.getByTestId('cell-0-1'); // Empty cell
    fireEvent.click(cellA2);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(0, 1);
  });

  it('does not call onCellClick when clicking already shot cell', () => {
    const handleClick = vi.fn();
    render(
      <GameBoard
        isOpponentBoard={true}
        shots={mockPlayerShots} // F6 is hit
        isPlayerTurn={true}
        onCellClick={handleClick}
      />
    );
    const cellF6 = screen.getByTestId('cell-5-5');
    fireEvent.click(cellF6);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onCellClick when it is not player turn', () => {
    const handleClick = vi.fn();
    render(
      <GameBoard
        isOpponentBoard={true}
        shots={mockPlayerShots}
        isPlayerTurn={false} // Not player's turn
        onCellClick={handleClick}
      />
    );
    const cellA2 = screen.getByTestId('cell-0-1');
    fireEvent.click(cellA2);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onCellClick when clicking player board', () => {
    const handleClick = vi.fn();
    render(
      <GameBoard
        isOpponentBoard={false} // Player board
        ships={mockShips}
        shots={mockOpponentShots}
        isPlayerTurn={true}
        onCellClick={handleClick}
      />
    );
    const cellA2 = screen.getByTestId('cell-0-1');
    fireEvent.click(cellA2);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('displays correct turn indicator text', () => {
    const { rerender } = render(
      <GameBoard isOpponentBoard={true} isPlayerTurn={true} />
    );
    expect(screen.getByText("Your turn - Take a shot!")).toBeInTheDocument();

    rerender(<GameBoard isOpponentBoard={true} isPlayerTurn={false} />);
    expect(screen.getByText("Opponent's turn")).toBeInTheDocument();
  });

  it('does not display turn indicator on player board', () => {
     render(<GameBoard isOpponentBoard={false} isPlayerTurn={true} />);
     expect(screen.queryByText("Your turn - Take a shot!")).not.toBeInTheDocument();
     expect(screen.queryByText("Opponent's turn")).not.toBeInTheDocument();
  });

  // Add more tests: hover effects (if feasible), lastShot animation trigger
}); 