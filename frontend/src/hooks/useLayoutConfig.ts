import { useState, useEffect } from 'react';
import { LayoutConfig, PanelConfig } from '../types/layout';

const defaultLayout: LayoutConfig = {
  sidebarPosition: 'right',
  theme: 'dark',
  panels: [
    { id: 'conversations', title: 'Conversations', component: 'ConversationList', position: 'right', size: 300, visible: true, pinned: true, order: 0, minimized: false },
    { id: 'extensions', title: 'Extensions', component: 'ExtensionPanel', position: 'left', size: 250, visible: false, pinned: false, order: 1, minimized: false },
    { id: 'files', title: 'Files', component: 'FileExplorer', position: 'left', size: 250, visible: false, pinned: false, order: 2, minimized: false },
    { id: 'terminal', title: 'Terminal', component: 'Terminal', position: 'bottom', size: 200, visible: false, pinned: false, order: 3, minimized: false },
    { id: 'output', title: 'Output', component: 'Output', position: 'bottom', size: 200, visible: false, pinned: false, order: 4, minimized: false }
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

  const movePanel = (id: string, position: 'left' | 'right' | 'bottom' | 'floating', floatingPosition?: { x: number; y: number }) => {
    const updates: Partial<PanelConfig> = { position };
    if (position === 'floating' && floatingPosition) {
      updates.floatingPosition = floatingPosition;
      updates.zIndex = Math.max(...layout.panels.map(p => p.zIndex || 0)) + 1;
    }
    updatePanel(id, updates);
  };

  const pinPanel = (id: string) => {
    updatePanel(id, { pinned: !layout.panels.find(p => p.id === id)?.pinned });
  };

  const minimizePanel = (id: string) => {
    updatePanel(id, { minimized: !layout.panels.find(p => p.id === id)?.minimized });
  };

  const resizePanel = (id: string, size: number) => {
    updatePanel(id, { size });
  };

  const setSidebarPosition = (position: 'left' | 'right') => {
    setLayout(prev => ({ ...prev, sidebarPosition: position }));
  };

  return {
    layout,
    updatePanel,
    togglePanel,
    movePanel,
    pinPanel,
    minimizePanel,
    resizePanel,
    setSidebarPosition
  };
};