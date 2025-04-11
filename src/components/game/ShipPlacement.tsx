import { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export interface Ship {
  id: string;
  name: string;
  size: number;
  isPlaced: boolean;
  position?: { x: number; y: number };
  isVertical: boolean;
}

const GRID_SIZE = 10;
const CELL_SIZE = 40;

const INITIAL_SHIPS: Ship[] = [
  { id: 'carrier', name: 'Carrier', size: 5, isPlaced: false, isVertical: false },
  { id: 'battleship', name: 'Battleship', size: 4, isPlaced: false, isVertical: false },
  { id: 'cruiser', name: 'Cruiser', size: 3, isPlaced: false, isVertical: false },
  { id: 'submarine', name: 'Submarine', size: 3, isPlaced: false, isVertical: false },
  { id: 'destroyer', name: 'Destroyer', size: 2, isPlaced: false, isVertical: false },
];

interface DraggableShipProps {
  ship: Ship;
  onRotate: () => void;
}

function DraggableShip({ ship, onRotate }: DraggableShipProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: ship.id,
    data: ship,
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-1 cursor-move select-none",
        ship.isVertical ? "flex-col" : "flex-row"
      )}
      style={style}
    >
      {Array.from({ length: ship.size }).map((_, i) => (
        <div
          key={i}
          className="w-[40px] h-[40px] bg-blue-500 border border-blue-600"
        />
      ))}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRotate();
        }}
        className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
      >
        Rotate
      </button>
    </div>
  );
}

interface GridCellProps {
  x: number;
  y: number;
  isOccupied?: boolean;
  isValid?: boolean;
}

function GridCell({ x, y, isOccupied, isValid }: GridCellProps) {
  const { setNodeRef } = useDroppable({
    id: `cell-${x}-${y}`,
    data: { x, y },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[40px] h-[40px] border border-gray-300",
        isOccupied && "bg-blue-500",
        isValid === false && "bg-red-200",
        isValid === true && "bg-green-200"
      )}
    />
  );
}

interface ShipPlacementProps {
  onPlacementComplete: (ships: Ship[]) => void;
}

export function ShipPlacement({ onPlacementComplete }: ShipPlacementProps) {
  const [ships, setShips] = useState<Ship[]>(INITIAL_SHIPS);
  const [draggedShip, setDraggedShip] = useState<Ship | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  const isValidPlacement = (ship: Ship, position: { x: number; y: number }): boolean => {
    if (!position) return false;

    // Check if ship is within bounds
    if (ship.isVertical) {
      if (position.y + ship.size > GRID_SIZE) return false;
    } else {
      if (position.x + ship.size > GRID_SIZE) return false;
    }

    // Check for overlapping ships
    for (let i = 0; i < ship.size; i++) {
      const checkX = ship.isVertical ? position.x : position.x + i;
      const checkY = ship.isVertical ? position.y + i : position.y;

      for (const otherShip of ships) {
        if (otherShip.id === ship.id || !otherShip.position) continue;

        for (let j = 0; j < otherShip.size; j++) {
          const otherX = otherShip.isVertical ? otherShip.position.x : otherShip.position.x + j;
          const otherY = otherShip.isVertical ? otherShip.position.y + j : otherShip.position.y;

          if (checkX === otherX && checkY === otherY) {
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const ship = ships.find(s => s.id === event.active.id);
    if (ship) setDraggedShip(ship);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const ship = ships.find(s => s.id === event.active.id);
    const dropData = event.over?.data.current as { x: number; y: number } | undefined;

    if (ship && dropData && isValidPlacement(ship, dropData)) {
      setShips(ships.map(s => 
        s.id === ship.id
          ? { ...s, isPlaced: true, position: dropData }
          : s
      ));
    }

    setDraggedShip(null);
    setHoverPosition(null);

    // Check if all ships are placed
    const allShipsPlaced = ships.every(s => s.isPlaced);
    if (allShipsPlaced) {
      onPlacementComplete(ships);
    }
  };

  const handleRotateShip = (shipId: string) => {
    setShips(ships.map(ship =>
      ship.id === shipId
        ? { ...ship, isVertical: !ship.isVertical }
        : ship
    ));
  };

  return (
    <div className="flex gap-8 p-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Your Ships</h2>
        <div className="grid grid-cols-[repeat(10,40px)] gap-0 border border-gray-400">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isOccupied = ships.some(ship => {
              if (!ship.position) return false;
              for (let j = 0; j < ship.size; j++) {
                const shipX = ship.isVertical ? ship.position.x : ship.position.x + j;
                const shipY = ship.isVertical ? ship.position.y + j : ship.position.y;
                if (shipX === x && shipY === y) return true;
              }
              return false;
            });

            let isValid = undefined;
            if (draggedShip && hoverPosition && x === hoverPosition.x && y === hoverPosition.y) {
              isValid = isValidPlacement(draggedShip, { x, y });
            }

            return (
              <GridCell
                key={`${x}-${y}`}
                x={x}
                y={y}
                isOccupied={isOccupied}
                isValid={isValid}
              />
            );
          })}
        </div>
      </div>

      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Available Ships</h2>
          <div className="flex flex-col gap-4">
            {ships.filter(ship => !ship.isPlaced).map(ship => (
              <DraggableShip
                key={ship.id}
                ship={ship}
                onRotate={() => handleRotateShip(ship.id)}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
} 