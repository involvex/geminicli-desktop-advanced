import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AppSettings {
  theme: string;
  gcloudHost: string;
  gcloudProject: string;
  gcloudRegion: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  autoSave: boolean;
  serverPort: number;
  enableDragDrop: boolean;
  enableScreenshot: boolean;
  enablePaste: boolean;
}

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "vscode-dark", label: "VS Code Dark" },
  { value: "github-dark", label: "GitHub Dark" },
  { value: "monokai", label: "Monokai" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>({
    theme: "system",
    gcloudHost: "https://generativelanguage.googleapis.com",
    gcloudProject: "",
    gcloudRegion: "us-central1",
    defaultModel: "gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 2048,
    autoSave: true,
    serverPort: 1858,
    enableDragDrop: true,
    enableScreenshot: true,
    enablePaste: true,
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gemini-desktop-settings");
    if (saved) {
      setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = () => {
    // Save to localStorage or backend
    localStorage.setItem("gemini-desktop-settings", JSON.stringify(settings));
    setHasChanges(false);
  };

  const resetSettings = () => {
    setSettings({
      theme: "system",
      gcloudHost: "https://generativelanguage.googleapis.com",
      gcloudProject: "",
      gcloudRegion: "us-central1",
      defaultModel: "gemini-2.5-flash",
      temperature: 0.7,
      maxTokens: 2048,
      autoSave: true,
      serverPort: 1858,
      enableDragDrop: true,
      enableScreenshot: true,
      enablePaste: true,
    });
    setHasChanges(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetSettings}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={saveSettings} disabled={!hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="theme" className="text-right">Theme</Label>
                  <Select value={settings.theme} onValueChange={(value) => updateSetting("theme", value)}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {themes.map(theme => (
                        <SelectItem key={theme.value} value={theme.value}>
                          {theme.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Google Cloud Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Google Cloud Configuration</CardTitle>
                <CardDescription>Configure custom Google Cloud endpoints and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gcloudHost" className="text-right">API Host</Label>
                  <Input
                    id="gcloudHost"
                    value={settings.gcloudHost}
                    onChange={(e) => updateSetting("gcloudHost", e.target.value)}
                    className="col-span-3"
                    placeholder="https://generativelanguage.googleapis.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gcloudProject" className="text-right">Project ID</Label>
                  <Input
                    id="gcloudProject"
                    value={settings.gcloudProject}
                    onChange={(e) => updateSetting("gcloudProject", e.target.value)}
                    className="col-span-3"
                    placeholder="your-project-id"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gcloudRegion" className="text-right">Region</Label>
                  <Select value={settings.gcloudRegion} onValueChange={(value) => updateSetting("gcloudRegion", value)}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-central1">us-central1</SelectItem>
                      <SelectItem value="us-east1">us-east1</SelectItem>
                      <SelectItem value="europe-west1">europe-west1</SelectItem>
                      <SelectItem value="asia-southeast1">asia-southeast1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Server Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Server Configuration</CardTitle>
                <CardDescription>Configure server deployment settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="serverPort" className="text-right">Server Port</Label>
                  <Input
                    id="serverPort"
                    type="number"
                    min="1024"
                    max="65535"
                    value={settings.serverPort}
                    onChange={(e) => updateSetting("serverPort", parseInt(e.target.value) || 1858)}
                    className="col-span-3"
                    placeholder="1858"
                  />
                </div>
                <p className="text-sm text-muted-foreground col-span-4">Port for web server deployment (requires restart)</p>
              </CardContent>
            </Card>

            {/* Model Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Model Configuration</CardTitle>
                <CardDescription>Default settings for AI model interactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="defaultModel" className="text-right">Default Model</Label>
                  <Select value={settings.defaultModel} onValueChange={(value) => updateSetting("defaultModel", value)}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="temperature" className="text-right">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => updateSetting("temperature", parseFloat(e.target.value))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="maxTokens" className="text-right">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="1"
                    max="8192"
                    value={settings.maxTokens}
                    onChange={(e) => updateSetting("maxTokens", parseInt(e.target.value))}
                    className="col-span-3"
                  />
                </div>
              </CardContent>
            </Card>

            {/* File Handling */}
            <Card>
              <CardHeader>
                <CardTitle>File Handling</CardTitle>
                <CardDescription>Configure file upload and screenshot features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enableDragDrop">Drag & Drop Files</Label>
                    <p className="text-sm text-muted-foreground">Allow dragging files into chat for context</p>
                  </div>
                  <Switch
                    id="enableDragDrop"
                    checked={settings.enableDragDrop}
                    onCheckedChange={(checked: boolean) => updateSetting("enableDragDrop", checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enableScreenshot">Screenshot Support</Label>
                    <p className="text-sm text-muted-foreground">Enable Print Screen key for screenshots</p>
                  </div>
                  <Switch
                    id="enableScreenshot"
                    checked={settings.enableScreenshot}
                    onCheckedChange={(checked: boolean) => updateSetting("enableScreenshot", checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enablePaste">Paste Images</Label>
                    <p className="text-sm text-muted-foreground">Allow Ctrl+V to paste images from clipboard</p>
                  </div>
                  <Switch
                    id="enablePaste"
                    checked={settings.enablePaste}
                    onCheckedChange={(checked: boolean) => updateSetting("enablePaste", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}