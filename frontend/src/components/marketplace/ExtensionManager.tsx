import React, { useState, useEffect } from 'react';
import { Extension, Command, Theme } from '../../types/marketplace';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Settings, Play, Pause } from 'lucide-react';

export const ExtensionManager: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);

  useEffect(() => {
    loadInstalledItems();
  }, []);

  const loadInstalledItems = () => {
    const installedExtensions = JSON.parse(localStorage.getItem('installed_extensions') || '[]');
    const installedCommands = JSON.parse(localStorage.getItem('installed_commands') || '[]');
    const installedThemes = JSON.parse(localStorage.getItem('installed_themes') || '[]');
    
    setExtensions(installedExtensions);
    setCommands(installedCommands);
    setThemes(installedThemes);
  };

  const uninstallItem = (type: 'extension' | 'command' | 'theme', id: string) => {
    const storageKey = `installed_${type}s`;
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const filtered = items.filter((item: { id: string }) => item.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(filtered));
    loadInstalledItems();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Extension Manager</h1>
      
      <Tabs defaultValue="extensions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="extensions">Extensions ({extensions.length})</TabsTrigger>
          <TabsTrigger value="commands">Commands ({commands.length})</TabsTrigger>
          <TabsTrigger value="themes">Themes ({themes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="extensions" className="space-y-4">
          {extensions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No extensions installed
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extensions.map((extension) => (
                <Card key={extension.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{extension.name}</CardTitle>
                        <CardDescription>v{extension.version} by {extension.author}</CardDescription>
                      </div>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{extension.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button size="sm" variant="outline">
                        <Pause className="w-4 h-4 mr-2" />
                        Disable
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => uninstallItem('extension', extension.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Uninstall
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          {commands.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No commands installed
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {commands.map((command) => (
                <Card key={command.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{command.name}</CardTitle>
                    <CardDescription>v{command.version} by {command.author}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{command.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Play className="w-4 h-4 mr-2" />
                        Run
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => uninstallItem('command', command.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Uninstall
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="themes" className="space-y-4">
          {themes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No themes installed
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themes.map((theme) => (
                <Card key={theme.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{theme.name}</CardTitle>
                    <CardDescription>v{theme.version} by {theme.author}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{theme.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Apply Theme
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => uninstallItem('theme', theme.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Uninstall
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};