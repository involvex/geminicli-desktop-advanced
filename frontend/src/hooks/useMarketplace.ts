import { useState, useCallback } from 'react';
import { MarketplaceItem, Extension, Command, Theme } from '../types/marketplace';

interface MarketplaceState {
  installedItems: MarketplaceItem[];
  loading: boolean;
  error: string | null;
}

export const useMarketplace = () => {
  const [state, setState] = useState<MarketplaceState>({
    installedItems: [],
    loading: false,
    error: null
  });

  const installItem = useCallback(async (item: MarketplaceItem) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      switch (item.category) {
        case 'extension':
          await installExtension(item as Extension);
          break;
        case 'command':
          await installCommand(item as Command);
          break;
        case 'theme':
          await installTheme(item as Theme);
          break;
      }
      
      setState(prev => ({
        ...prev,
        installedItems: [...prev.installedItems, item],
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Installation failed'
      }));
    }
  }, []);

  const uninstallItem = useCallback(async (itemId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Remove from installed items
      setState(prev => ({
        ...prev,
        installedItems: prev.installedItems.filter(item => item.id !== itemId),
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Uninstallation failed'
      }));
    }
  }, []);

  const installExtension = async (extension: Extension) => {
    // Install extension logic
    console.log('Installing extension:', extension.name);
    
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Store extension in local storage or backend
    const extensions = JSON.parse(localStorage.getItem('installed_extensions') || '[]');
    extensions.push(extension);
    localStorage.setItem('installed_extensions', JSON.stringify(extensions));
  };

  const installCommand = async (command: Command) => {
    // Install command logic
    console.log('Installing command:', command.name);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const commands = JSON.parse(localStorage.getItem('installed_commands') || '[]');
    commands.push(command);
    localStorage.setItem('installed_commands', JSON.stringify(commands));
  };

  const installTheme = async (theme: Theme) => {
    // Install theme logic
    console.log('Installing theme:', theme.name);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const themes = JSON.parse(localStorage.getItem('installed_themes') || '[]');
    themes.push(theme);
    localStorage.setItem('installed_themes', JSON.stringify(themes));
  };

  return {
    ...state,
    installItem,
    uninstallItem
  };
};