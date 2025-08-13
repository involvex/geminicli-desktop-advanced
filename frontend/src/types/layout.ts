export interface PanelConfig {
  id: string;
  title: string;
  component: string;
  position: 'left' | 'right' | 'bottom' | 'floating';
  size: number;
  visible: boolean;
  pinned: boolean;
  order: number;
}

export interface LayoutConfig {
  panels: PanelConfig[];
  sidebarPosition: 'left' | 'right';
  theme: 'dark' | 'light' | 'system';
}