import React from 'react';
import { TaskManager } from '../components/system/TaskManager';

const TaskManagerPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-auto">
      <TaskManager />
    </div>
  );
};

export default TaskManagerPage;