import React from 'react';
import { SystemMonitor } from '../components/system/SystemMonitor';

const SystemMonitorPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-auto">
      <SystemMonitor />
    </div>
  );
};

export default SystemMonitorPage;