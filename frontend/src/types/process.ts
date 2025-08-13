export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command: string;
  status: 'running' | 'sleeping' | 'zombie';
  user: string;
  startTime: string;
}

export interface NetworkAgent {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'ws' | 'tcp';
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string;
  type: 'gemini-cli' | 'mcp-server' | 'agent' | 'unknown';
}