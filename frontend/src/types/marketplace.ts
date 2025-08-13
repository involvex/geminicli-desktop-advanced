export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: 'extension' | 'command' | 'theme';
  tags: string[];
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  icon?: string;
  screenshots?: string[];
  repository?: string;
  homepage?: string;
  license: string;
}

export interface Extension extends MarketplaceItem {
  category: 'extension';
  manifest: ExtensionManifest;
  bundle: string;
}

export interface Command extends MarketplaceItem {
  category: 'command';
  command: string;
  parameters: CommandParameter[];
  examples: string[];
}

export interface Theme extends MarketplaceItem {
  category: 'theme';
  colors: ThemeColors;
  preview: string;
}

export interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  permissions: string[];
  contributes: {
    commands?: CommandContribution[];
    menus?: MenuContribution[];
    keybindings?: KeybindingContribution[];
  };
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'folder';
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
}

export interface CommandContribution {
  command: string;
  title: string;
  category?: string;
}

export interface MenuContribution {
  command: string;
  when?: string;
  group?: string;
}

export interface KeybindingContribution {
  command: string;
  key: string;
  when?: string;
}

export interface MarketplaceFilter {
  category?: 'extension' | 'command' | 'theme';
  tags?: string[];
  search?: string;
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}