export interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    available: number;
  };
  gpu?: {
    usage: number;
    memory: {
      used: number;
      total: number;
    };
    temperature?: number;
  };
}

export interface ModelStats {
  modelName: string;
  isActive: boolean;
  stats: SystemStats;
  toolCalls: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  throttling: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    currentRequests: number;
  };
}