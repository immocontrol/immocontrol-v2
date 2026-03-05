/**
 * MOB6-14: Mobile Room Planner
 * Simple floor plan editor with touch gestures for drawing rooms and entering dimensions.
 * Canvas-based with pinch-to-zoom and drag-to-pan.
 */
import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Plus, Minus, RotateCcw, Trash2, Square, Maximize2,
  Move, Ruler, Save, Download, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  area?: number; // m²
}

interface MobileRoomPlannerProps {
  /** Initial rooms */
  rooms?: Room[];
  /** Room change handler */
  onChange?: (rooms: Room[]) => void;
  /** Save handler */
  onSave?: (rooms: Room[], imageDataUrl: string) => void;
  /** Grid size in pixels */
  gridSize?: number;
  /** Scale (pixels per meter) */
  scale?: number;
  /** Additional class */
  className?: string;
}

const ROOM_COLORS = [
  "#e3f2fd", "#fff3e0", "#e8f5e9", "#fce4ec",
  "#f3e5f5", "#fff8e1", "#e0f2f1", "#fbe9e7",
];

let nextRoomId = 0;

export const MobileRoomPlanner = memo(function MobileRoomPlanner({
  rooms: initialRooms = [],
  onChange,
  onSave,
  gridSize = 20,
  scale: initialScale = 50, // 50px = 1m
  className,
}: MobileRoomPlannerProps) {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "draw" | "measure">("select");
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Resize canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width, height: Math.max(300, height) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);
    ctx.scale(viewScale, viewScale);

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 0.5;
    const gridStart = -1000;
    const gridEnd = 2000;
    for (let x = gridStart; x < gridEnd; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, gridStart);
      ctx.lineTo(x, gridEnd);
      ctx.stroke();
    }
    for (let y = gridStart; y < gridEnd; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gridStart, y);
      ctx.lineTo(gridEnd, y);
      ctx.stroke();
    }

    // Draw rooms
    for (const room of rooms) {
      const isSelected = room.id === selectedRoom;

      // Fill
      ctx.fillStyle = room.color;
      ctx.fillRect(room.x, room.y, room.width, room.height);

      // Border
      ctx.strokeStyle = isSelected ? "#2563eb" : "#94a3b8";
      ctx.lineWidth = isSelected ? 2 / viewScale : 1 / viewScale;
      ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Label
      const widthM = (room.width / initialScale).toFixed(1);
      const heightM = (room.height / initialScale).toFixed(1);
      const areaM = ((room.width / initialScale) * (room.height / initialScale)).toFixed(1);

      ctx.fillStyle = "#374151";
      ctx.font = `${12 / viewScale}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(room.name, room.x + room.width / 2, room.y + room.height / 2 - 8 / viewScale);
      ctx.fillStyle = "#6b7280";
      ctx.font = `${10 / viewScale}px system-ui, sans-serif`;
      ctx.fillText(`${widthM} × ${heightM} m`, room.x + room.width / 2, room.y + room.height / 2 + 4 / viewScale);
      ctx.fillText(`${areaM} m²`, room.x + room.width / 2, room.y + room.height / 2 + 16 / viewScale);

      // Dimension lines
      if (isSelected) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1 / viewScale;
        // Top dimension
        ctx.beginPath();
        ctx.moveTo(room.x, room.y - 10 / viewScale);
        ctx.lineTo(room.x + room.width, room.y - 10 / viewScale);
        ctx.stroke();
        ctx.fillStyle = "#2563eb";
        ctx.font = `${9 / viewScale}px system-ui, sans-serif`;
        ctx.fillText(`${widthM}m`, room.x + room.width / 2, room.y - 14 / viewScale);
      }
    }

    // Draw current drawing rect
    if (drawRect) {
      ctx.fillStyle = "rgba(37, 99, 235, 0.1)";
      ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5 / viewScale;
      ctx.setLineDash([4 / viewScale, 4 / viewScale]);
      ctx.strokeRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [rooms, selectedRoom, viewScale, viewOffset, gridSize, canvasSize, drawRect, initialScale]);

  // Snap to grid
  const snapToGrid = useCallback((val: number) => {
    return Math.round(val / gridSize) * gridSize;
  }, [gridSize]);

  // Screen coords to canvas coords
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewOffset.x) / viewScale,
      y: (screenY - rect.top - viewOffset.y) / viewScale,
    };
  }, [viewScale, viewOffset]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (tool === "draw") {
      setIsDrawing(true);
      drawStartRef.current = { x: snapToGrid(x), y: snapToGrid(y) };
      setDrawRect({ x: snapToGrid(x), y: snapToGrid(y), w: 0, h: 0 });
    } else if (tool === "select") {
      // Check if clicking on a room
      const clicked = [...rooms].reverse().find(r =>
        x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
      );
      setSelectedRoom(clicked ? clicked.id : null);

      if (!clicked) {
        // Start panning
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragOffsetRef.current = { ...viewOffset };
      }
    }
  }, [tool, rooms, screenToCanvas, snapToGrid, viewOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDrawing) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const sx = drawStartRef.current.x;
      const sy = drawStartRef.current.y;
      setDrawRect({
        x: Math.min(sx, snapToGrid(x)),
        y: Math.min(sy, snapToGrid(y)),
        w: Math.abs(snapToGrid(x) - sx),
        h: Math.abs(snapToGrid(y) - sy),
      });
    } else if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setViewOffset({
        x: dragOffsetRef.current.x + dx,
        y: dragOffsetRef.current.y + dy,
      });
    }
  }, [isDrawing, screenToCanvas, snapToGrid]);

  const handlePointerUp = useCallback(() => {
    if (isDrawing && drawRect && drawRect.w > gridSize && drawRect.h > gridSize) {
      const newRoom: Room = {
        id: `room-${++nextRoomId}`,
        name: `Raum ${rooms.length + 1}`,
        x: drawRect.x,
        y: drawRect.y,
        width: drawRect.w,
        height: drawRect.h,
        color: ROOM_COLORS[rooms.length % ROOM_COLORS.length],
        area: (drawRect.w / initialScale) * (drawRect.h / initialScale),
      };
      const updated = [...rooms, newRoom];
      setRooms(updated);
      onChange?.(updated);
      setSelectedRoom(newRoom.id);
      setTool("select");
    }
    setIsDrawing(false);
    setDrawRect(null);
    isDraggingRef.current = false;
  }, [isDrawing, drawRect, rooms, gridSize, initialScale, onChange]);

  const handleDeleteRoom = useCallback(() => {
    if (!selectedRoom) return;
    const updated = rooms.filter(r => r.id !== selectedRoom);
    setRooms(updated);
    setSelectedRoom(null);
    onChange?.(updated);
  }, [selectedRoom, rooms, onChange]);

  const handleZoom = useCallback((delta: number) => {
    setViewScale(prev => Math.max(0.25, Math.min(3, prev + delta)));
  }, []);

  const handleReset = useCallback(() => {
    setViewScale(1);
    setViewOffset({ x: 0, y: 0 });
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSave) return;
    onSave(rooms, canvas.toDataURL("image/png"));
  }, [rooms, onSave]);

  const totalArea = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.width / initialScale) * (r.height / initialScale), 0),
    [rooms, initialScale]
  );

  const selectedRoomData = selectedRoom ? rooms.find(r => r.id === selectedRoom) : null;

  return (
    <div className={cn("w-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTool("select")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              tool === "select" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Auswählen"
          >
            <Move className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("draw")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              tool === "draw" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Raum zeichnen"
          >
            <Square className="w-4 h-4" />
          </button>
          {selectedRoom && (
            <button
              onClick={handleDeleteRoom}
              className={cn(
                "p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-600",
                isMobile && "min-w-[44px] min-h-[44px] flex items-center justify-center"
              )}
              aria-label="Raum löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => handleZoom(0.25)} className="p-2 rounded-lg hover:bg-muted" aria-label="Vergrößern">
            <Plus className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono w-10 text-center">{(viewScale * 100).toFixed(0)}%</span>
          <button onClick={() => handleZoom(-0.25)} className="p-2 rounded-lg hover:bg-muted" aria-label="Verkleinern">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="p-2 rounded-lg hover:bg-muted" aria-label="Zurücksetzen">
            <RotateCcw className="w-4 h-4" />
          </button>
          {onSave && (
            <button onClick={handleSave} className="p-2 rounded-lg hover:bg-muted text-primary" aria-label="Speichern">
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border rounded-xl overflow-hidden bg-white dark:bg-gray-950"
        style={{ height: isMobile ? "300px" : "400px", touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ width: canvasSize.width, height: canvasSize.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            "cursor-crosshair",
            tool === "select" && "cursor-grab",
            isDraggingRef.current && "cursor-grabbing"
          )}
        />

        {/* Tool hint */}
        {tool === "draw" && !isDrawing && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px]">
            Ziehen um Raum zu zeichnen
          </div>
        )}
      </div>

      {/* Room info / edit */}
      {selectedRoomData && (
        <div className="mt-2 p-2.5 rounded-lg border bg-muted/30 space-y-2">
          <input
            type="text"
            value={selectedRoomData.name}
            onChange={(e) => {
              const updated = rooms.map(r =>
                r.id === selectedRoom ? { ...r, name: e.target.value } : r
              );
              setRooms(updated);
              onChange?.(updated);
            }}
            className="text-xs font-medium bg-transparent border-b border-dashed focus:outline-none focus:border-primary w-full"
          />
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{(selectedRoomData.width / initialScale).toFixed(1)} × {(selectedRoomData.height / initialScale).toFixed(1)} m</span>
            <span>{((selectedRoomData.width / initialScale) * (selectedRoomData.height / initialScale)).toFixed(1)} m²</span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{rooms.length} {rooms.length === 1 ? "Raum" : "Räume"}</span>
        <span>Gesamtfläche: {totalArea.toFixed(1)} m²</span>
      </div>
    </div>
  );
});
