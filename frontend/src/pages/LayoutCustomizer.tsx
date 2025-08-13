import React from 'react';
import { LayoutCustomizer } from '../components/layout/LayoutCustomizer';

const LayoutCustomizerPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-auto">
      <LayoutCustomizer />
    </div>
  );
};

export default LayoutCustomizerPage;