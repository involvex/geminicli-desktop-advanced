import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Cpu, MemoryStick, Zap, Settings, Activity } from 'lucide-react';
import { ModelStats } from '../../types/system';

export const ModelStatsPanel: React.FC = () => {
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [showThrottling, setShowThrottling] = useState(false);

  useEffect(() => {
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    const mockStats: ModelStats[] = [
      {
        modelName: 'gemini-2.5-flash',
        isActive: true,
        stats: {
          cpu: { usage: 45, cores: 8, temperature: 65 },
          memory: { used: 2.1, total: 16, available: 13.9 },
          gpu: { usage: 78, memory: { used: 4.2, total: 8 }, temperature: 72 }
        },
        toolCalls: { total: 156, successful: 148, failed: 8, avgResponseTime: 1.2 },
        throttling: { enabled: false, maxRequestsPerMinute: 60, currentRequests: 12 }
      }
    ];
    setModelStats(mockStats);
  };

  const updateThrottling = (modelName: string, enabled: boolean, maxRequests: number) => {
    setModelStats(prev => prev.map(model => 
      model.modelName === modelName 
        ? { ...model, throttling: { ...model.throttling, enabled, maxRequestsPerMinute: maxRequests }}
        : model
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Model Performance</h2>
        <Button variant="outline" size="sm" onClick={() => setShowThrottling(!showThrottling)}>
          <Settings className="w-4 h-4 mr-2" />
          Throttling
        </Button>
      </div>

      {modelStats.map((model) => (
        <Card key={model.modelName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{model.modelName}</CardTitle>
              <Badge variant={model.isActive ? "default" : "secondary"}>
                {model.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-sm font-medium">{model.stats.cpu.usage}%</div>
                  <div className="text-xs text-gray-500">CPU</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4 text-green-500" />
                <div>
                  <div className="text-sm font-medium">{model.stats.memory.used.toFixed(1)} GB</div>
                  <div className="text-xs text-gray-500">RAM</div>
                </div>
              </div>
              
              {model.stats.gpu && (
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-sm font-medium">{model.stats.gpu.usage}%</div>
                    <div className="text-xs text-gray-500">GPU</div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" />
                <div>
                  <div className="text-sm font-medium">{model.toolCalls.total}</div>
                  <div className="text-xs text-gray-500">Tool Calls</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium text-green-600">{model.toolCalls.successful}</div>
                <div className="text-xs text-gray-500">Successful</div>
              </div>
              <div>
                <div className="font-medium text-red-600">{model.toolCalls.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div>
                <div className="font-medium">{model.toolCalls.avgResponseTime}s</div>
                <div className="text-xs text-gray-500">Avg Response</div>
              </div>
            </div>

            {showThrottling && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Enable Throttling</Label>
                  <Button
                    variant={model.throttling.enabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateThrottling(model.modelName, !model.throttling.enabled, model.throttling.maxRequestsPerMinute)}
                  >
                    {model.throttling.enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                
                {model.throttling.enabled && (
                  <div className="space-y-2">
                    <Label>Max Requests/Minute</Label>
                    <Input
                      type="number"
                      value={model.throttling.maxRequestsPerMinute}
                      onChange={(e) => updateThrottling(model.modelName, true, parseInt(e.target.value))}
                      className="w-24"
                    />
                    <div className="text-xs text-gray-500">
                      Current: {model.throttling.currentRequests}/{model.throttling.maxRequestsPerMinute}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};