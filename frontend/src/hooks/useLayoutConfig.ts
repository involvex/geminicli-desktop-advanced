import { useState, useEffect } from 'react';
import { LayoutConfig, PanelConfig } from '../types/layout';

const defaultLayout: LayoutConfig = {
  sidebarPosition: 'right',
  theme: 'dark',
  panels: [
    { id: 'conversations', title: 'Conversations', component: 'ConversationList', position: 'right', size: 300, visible: true, pinned: true, order: 0 },
    { id: 'extensions', title: 'Extensions', component: 'ExtensionPanel', position: 'left', size: 250, visible: false, pinned: false, order: 1 },
    { id: 'files', title: 'Files', component: 'FileExplorer', position: 'left', size: 250, visible: false, pinned: false, order: 2 }
  ]
};

export const useLayoutConfig = () => {
  const [layout, setLayout] = useState<LayoutConfig>(() => {
    const saved = localStorage.getItem('gemini-layout-config');
    return saved ? JSON.parse(saved) : defaultLayout;
  });

  useEffect(() => {
    localStorage.setItem('gemini-layout-config', JSON.stringify(layout));
  }, [layout]);

  const updatePanel = (id: string, updates: Partial<PanelConfig>) => {
    setLayout(prev => ({
      ...prev,
      panels: prev.panels.map(panel => 
        panel.id === id ? { ...panel, ...updates } : panel
      )
    }));
  };

  const togglePanel = (id: string) => {
    updatePanel(id, { visible: !layout.panels.find(p => p.id === id)?.visible });
  };

  const movePanel = (id: string, position: 'left' | 'right' | 'bottom' | 'floating') => {
    updatePanel(id, { position });
  };

  const setSidebarPosition = (position: 'left' | 'right') => {
    setLayout(prev => ({ ...prev, sidebarPosition: position }));
  };

  return {
    layout,
    updatePanel,
    togglePanel,
    movePanel,
    setSidebarPosition
  };
};