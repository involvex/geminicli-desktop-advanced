import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface AppSettingsType {
  settings_location: 'ProjectRoot' | 'Global' | 'User';
  hotkeys: {
    quick_open: string;
    toggle_chat: string;
    screenshot: string;
    import_file: string;
  };
  ui: {
    start_minimized: boolean;
    close_to_tray: boolean;
    theme: string;
  };
}

export function AppSettings() {
  const [settings, setSettings] = useState<AppSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<AppSettingsType>('get_settings');
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      await invoke('save_settings', { settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<AppSettingsType>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
  };

  const updateHotkeys = (updates: Partial<AppSettingsType['hotkeys']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      hotkeys: { ...settings.hotkeys, ...updates }
    });
  };

  const updateUI = (updates: Partial<AppSettingsType['ui']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ui: { ...settings.ui, ...updates }
    });
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  if (!settings) {
    return <div>Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hotkeys">Hotkeys</TabsTrigger>
          <TabsTrigger value="ui">Interface</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure where settings are stored and general application behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-location">Settings Location</Label>
                <Select
                  value={settings.settings_location}
                  onValueChange={(value: 'ProjectRoot' | 'Global' | 'User') =>
                    updateSettings({ settings_location: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User">User Directory (~/.gemini-desktop/)</SelectItem>
                    <SelectItem value="ProjectRoot">Project Root (./gemini-desktop-settings.json)</SelectItem>
                    <SelectItem value="Global">Global (/etc/gemini-desktop/ or C:\\ProgramData\\)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotkeys">
          <Card>
            <CardHeader>
              <CardTitle>Global Hotkeys</CardTitle>
              <CardDescription>
                Configure keyboard shortcuts that work system-wide.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-open">Quick Open Window</Label>
                <Input
                  id="quick-open"
                  value={settings.hotkeys.quick_open}
                  onChange={(e) => updateHotkeys({ quick_open: e.target.value })}
                  placeholder="Ctrl+Shift+G"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="toggle-chat">Toggle Chat</Label>
                <Input
                  id="toggle-chat"
                  value={settings.hotkeys.toggle_chat}
                  onChange={(e) => updateHotkeys({ toggle_chat: e.target.value })}
                  placeholder="Ctrl+Shift+C"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="screenshot">Take Screenshot</Label>
                <Input
                  id="screenshot"
                  value={settings.hotkeys.screenshot}
                  onChange={(e) => updateHotkeys({ screenshot: e.target.value })}
                  placeholder="Ctrl+Shift+S"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="import-file">Import File</Label>
                <Input
                  id="import-file"
                  value={settings.hotkeys.import_file}
                  onChange={(e) => updateHotkeys({ import_file: e.target.value })}
                  placeholder="Ctrl+Shift+I"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ui">
          <Card>
            <CardHeader>
              <CardTitle>Interface Settings</CardTitle>
              <CardDescription>
                Configure the application interface and behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="start-minimized">Start Minimized</Label>
                  <div className="text-sm text-muted-foreground">
                    Start the application minimized to system tray
                  </div>
                </div>
                <Switch
                  id="start-minimized"
                  checked={settings.ui.start_minimized}
                  onCheckedChange={(checked) => updateUI({ start_minimized: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="close-to-tray">Close to Tray</Label>
                  <div className="text-sm text-muted-foreground">
                    Minimize to system tray instead of closing when X is clicked
                  </div>
                </div>
                <Switch
                  id="close-to-tray"
                  checked={settings.ui.close_to_tray}
                  onCheckedChange={(checked) => updateUI({ close_to_tray: checked })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.ui.theme}
                  onValueChange={(value) => updateUI({ theme: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}