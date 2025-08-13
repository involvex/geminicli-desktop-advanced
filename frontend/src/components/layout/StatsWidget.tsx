import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Cpu, MemoryStick, Zap, Activity } from 'lucide-react';
import { ModelStats } from '../../types/system';

export const StatsWidget: React.FC = () => {
  const [stats, setStats] = useState<ModelStats | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        modelName: 'gemini-2.5-flash',
        isActive: true,
        stats: {
          cpu: { usage: Math.floor(Math.random() * 30) + 30, cores: 8 },
          memory: { used: Math.random() * 2 + 1.5, total: 16, available: 14 },
          gpu: { usage: Math.floor(Math.random() * 40) + 60, memory: { used: 4.2, total: 8 } }
        },
        toolCalls: { total: 156, successful: 148, failed: 8, avgResponseTime: 1.2 },
        throttling: { enabled: false, maxRequestsPerMinute: 60, currentRequests: 12 }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <Card className="w-64">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{stats.modelName}</span>
          <Badge variant="default" className="text-xs">Active</Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-500" />
            <span>{stats.stats.cpu.usage}%</span>
          </div>
          <div className="flex items-center gap-1">
            <MemoryStick className="w-3 h-3 text-green-500" />
            <span>{stats.stats.memory.used.toFixed(1)}GB</span>
          </div>
          {stats.stats.gpu && (
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-500" />
              <span>{stats.stats.gpu.usage}%</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-orange-500" />
            <span>{stats.toolCalls.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};