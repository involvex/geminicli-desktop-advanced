import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Play, Square, RotateCcw } from "lucide-react";
import { Server } from "../../types";

interface ServerStatusIndicatorProps {
  server: Server;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
}

export function ServerStatusIndicator({ 
  server, 
  onStart, 
  onStop, 
  onRestart 
}: ServerStatusIndicatorProps) {
  const isRunning = server.status === "running";
  
  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isRunning ? "default" : "secondary"}
        className={isRunning ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
      >
        <div className={`w-2 h-2 rounded-full mr-1 ${isRunning ? "bg-green-500" : "bg-gray-400"}`} />
        {server.status}
        {server.pid && ` (PID: ${server.pid})`}
      </Badge>
      
      <div className="flex gap-1">
        {!isRunning ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStart(server.id)}
            className="h-6 px-2"
          >
            <Play className="h-3 w-3" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStop(server.id)}
              className="h-6 px-2"
            >
              <Square className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRestart(server.id)}
              className="h-6 px-2"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}