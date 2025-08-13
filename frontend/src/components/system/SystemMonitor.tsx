import React from 'react';
import { ModelStatsPanel } from './ModelStatsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Activity, TrendingUp } from 'lucide-react';

export const SystemMonitor: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-6 h-6" />
        <h1 className="text-2xl font-bold">System Monitor</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ModelStatsPanel />
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Models</span>
                <span className="font-medium">1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Tool Calls</span>
                <span className="font-medium">156</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="font-medium text-green-600">94.9%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response</span>
                <span className="font-medium">1.2s</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};