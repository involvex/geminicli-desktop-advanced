import React, { useState, useEffect } from 'react';
import { ProcessInfo, NetworkAgent } from '../../types/process';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Search, RefreshCw, Zap, Network, AlertTriangle } from 'lucide-react';

export const TaskManager: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [agents, setAgents] = useState<NetworkAgent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProcesses();
    scanNetworkAgents();
    const interval = setInterval(() => {
      loadProcesses();
      scanNetworkAgents();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual system calls
      const mockProcesses: ProcessInfo[] = [
        { pid: 1234, name: 'node', cpu: 15.2, memory: 128.5, command: 'node gemini-cli', status: 'running', user: 'user', startTime: '10:30:15' },
        { pid: 5678, name: 'python', cpu: 8.1, memory: 64.2, command: 'python mcp-server.py', status: 'running', user: 'user', startTime: '10:25:30' },
        { pid: 9012, name: 'chrome', cpu: 25.8, memory: 512.1, command: 'chrome --remote-debugging', status: 'running', user: 'user', startTime: '09:15:45' }
      ];
      setProcesses(mockProcesses);
    } catch (error) {
      console.error('Failed to load processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const scanNetworkAgents = async () => {
    try {
      // Mock network scan - replace with actual network discovery
      const mockAgents: NetworkAgent[] = [
        { id: '1', name: 'Gemini CLI', host: 'localhost', port: 8080, protocol: 'http', status: 'online', lastSeen: '2 min ago', type: 'gemini-cli' },
        { id: '2', name: 'MCP Server', host: '192.168.1.100', port: 3000, protocol: 'ws', status: 'online', lastSeen: '1 min ago', type: 'mcp-server' },
        { id: '3', name: 'Agent Node', host: '192.168.1.101', port: 9000, protocol: 'tcp', status: 'offline', lastSeen: '5 min ago', type: 'agent' }
      ];
      setAgents(mockAgents);
    } catch (error) {
      console.error('Failed to scan network:', error);
    }
  };

  const killProcess = async (pid: number) => {
    try {
      // Mock kill process - replace with actual system call
      console.log(`Killing process ${pid}`);
      setProcesses(prev => prev.filter(p => p.pid !== pid));
    } catch (error) {
      console.error('Failed to kill process:', error);
    }
  };

  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.command.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Manager</h1>
        <Button onClick={loadProcesses} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="processes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="processes">Processes</TabsTrigger>
          <TabsTrigger value="network">Network Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="processes" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search processes..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Running Processes ({filteredProcesses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredProcesses.map((process) => (
                  <div key={process.pid} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{process.name}</span>
                        <Badge variant={process.status === 'running' ? 'default' : 'secondary'}>
                          {process.status}
                        </Badge>
                        <span className="text-sm text-gray-500">PID: {process.pid}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{process.command}</div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        <span>CPU: {process.cpu}%</span>
                        <span>Memory: {process.memory} MB</span>
                        <span>User: {process.user}</span>
                        <span>Started: {process.startTime}</span>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => killProcess(process.pid)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Kill
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Network Agents ({agents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant={agent.status === 'online' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                        <Badge variant="outline">{agent.type}</Badge>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {agent.protocol}://{agent.host}:{agent.port}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last seen: {agent.lastSeen}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {agent.status === 'offline' && (
                        <Button variant="outline" size="sm">
                          <Zap className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                      {agent.status === 'online' && (
                        <Button variant="destructive" size="sm">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};