import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, Download, Save, Trash2, Eye, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { CustomTheme, ThemePreset, ThemeColors } from "../lib/webApi";

export default function ThemeBuilderPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<CustomTheme>({
    name: "My Custom Theme",
    description: "",
    author: "",
    version: "1.0.0",
    colors: {
      background: "#ffffff",
      foreground: "#000000",
      primary: "#3b82f6",
      secondary: "#6b7280",
      accent: "#f59e0b",
      muted: "#f3f4f6",
      border: "#e5e7eb",
      card: "#ffffff",
      popover: "#ffffff",
      destructive: "#dc2626",
      warning: "#f59e0b",
      success: "#16a34a",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [savedThemes, setSavedThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use fallback data if API calls fail
        const presetList = [
          {
            name: "Dark",
            description: "Classic dark theme",
            colors: {
              background: "#0a0a0a",
              foreground: "#fafafa",
              primary: "#fafafa",
              secondary: "#262626",
              accent: "#f4f4f5",
              muted: "#171717",
              border: "#262626",
              card: "#0a0a0a",
              popover: "#0a0a0a",
              destructive: "#dc2626",
              warning: "#f59e0b",
              success: "#16a34a",
            }
          },
          {
            name: "Light",
            description: "Clean light theme",
            colors: {
              background: "#ffffff",
              foreground: "#0a0a0a",
              primary: "#171717",
              secondary: "#f4f4f5",
              accent: "#0a0a0a",
              muted: "#f4f4f5",
              border: "#e4e4e7",
              card: "#ffffff",
              popover: "#ffffff",
              destructive: "#dc2626",
              warning: "#f59e0b",
              success: "#16a34a",
            }
          }
        ];
        setPresets(presetList);
        setSavedThemes([]);
      } catch (err) {
        console.error("Failed to fetch theme data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const updateColor = (key: keyof ThemeColors, value: string) => {
    setTheme(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
      updated_at: new Date().toISOString()
    }));
  };

  const updateThemeInfo = (key: keyof Omit<CustomTheme, 'colors'>, value: string) => {
    setTheme(prev => ({
      ...prev,
      [key]: value,
      updated_at: new Date().toISOString()
    }));
  };

  const loadPreset = (preset: ThemePreset) => {
    setTheme(prev => ({
      ...prev,
      colors: preset.colors,
      updated_at: new Date().toISOString()
    }));
  };

  const loadSavedTheme = async (themeName: string) => {
    try {
      const savedTheme = await api.invoke<CustomTheme>("load_theme", { name: themeName });
      setTheme(savedTheme);
    } catch (err) {
      console.error("Failed to load theme:", err);
    }
  };

  const saveTheme = async () => {
    try {
      // For now, just add to local state
      setSavedThemes(prev => [...prev, theme.name]);
      console.log("Theme saved locally:", theme.name);
    } catch (err) {
      console.error("Failed to save theme:", err);
    }
  };

  const deleteTheme = async (themeName: string) => {
    try {
      await api.invoke("delete_theme", { name: themeName });
      const updatedThemes = await api.invoke<string[]>("list_themes");
      setSavedThemes(updatedThemes);
    } catch (err) {
      console.error("Failed to delete theme:", err);
    }
  };

  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    });
  }, [theme.colors]);

  const exportTheme = () => {
    const css = `:root {\n${Object.entries(theme.colors)
      .map(([key, value]) => `  --${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
      .join('\n')}\n}`;
    
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}.css`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyThemeJson = () => {
    navigator.clipboard.writeText(JSON.stringify(theme, null, 2));
  };

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to Home</span>
          </button>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Theme Builder</h1>
              <p className="text-muted-foreground">Create and customize your own themes</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyTheme} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={saveTheme} variant="outline">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button onClick={exportTheme}>
                <Download className="h-4 w-4 mr-2" />
                Export CSS
              </Button>
              <Button onClick={copyThemeJson} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
            </div>
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create Theme</TabsTrigger>
              <TabsTrigger value="presets">Presets</TabsTrigger>
              <TabsTrigger value="saved">Saved Themes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Theme Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="theme-name">Theme Name</Label>
                      <Input
                        id="theme-name"
                        value={theme.name}
                        onChange={(e) => updateThemeInfo('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="theme-description">Description</Label>
                      <Input
                        id="theme-description"
                        value={theme.description || ''}
                        onChange={(e) => updateThemeInfo('description', e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <Label htmlFor="theme-author">Author</Label>
                      <Input
                        id="theme-author"
                        value={theme.author || ''}
                        onChange={(e) => updateThemeInfo('author', e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Color Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                    {Object.entries(theme.colors).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <Label className="w-24 capitalize text-sm">{key.replace(/([A-Z])/g, ' $1')}</Label>
                        <Input
                          type="color"
                          value={value}
                          onChange={(e) => updateColor(key as keyof ThemeColors, e.target.value)}
                          className="w-16 h-10 p-1 border rounded"
                        />
                        <Input
                          value={value}
                          onChange={(e) => updateColor(key as keyof ThemeColors, e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="presets" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Built-in Theme Presets</h3>
                {loading ? (
                  <p>Loading presets...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {presets.map((preset) => (
                      <Card key={preset.name} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => loadPreset(preset)}>
                        <CardHeader>
                          <CardTitle className="text-lg">{preset.name}</CardTitle>
                          <CardContent className="p-0">
                            <p className="text-sm text-muted-foreground mb-3">{preset.description}</p>
                            <div className="flex gap-1">
                              {Object.entries(preset.colors).slice(0, 6).map(([key, color]) => (
                                <div
                                  key={key}
                                  className="w-6 h-6 rounded border"
                                  style={{ backgroundColor: color }}
                                  title={`${key}: ${color}`}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="saved" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Your Saved Themes</h3>
                {loading ? (
                  <p>Loading saved themes...</p>
                ) : savedThemes.length === 0 ? (
                  <p className="text-muted-foreground">No saved themes yet. Create and save a theme to see it here.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {savedThemes.map((themeName) => (
                      <Card key={themeName} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-lg">{themeName}</CardTitle>
                          <CardContent className="p-0">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadSavedTheme(themeName)}
                              >
                                Load
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteTheme(themeName)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 p-4 rounded-lg border" style={{ 
                backgroundColor: theme.colors.background,
                color: theme.colors.foreground,
                borderColor: theme.colors.border
              }}>
                <div className="flex items-center gap-2">
                  <div 
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background
                    }}
                  >
                    Primary Button
                  </div>
                  <div 
                    className="px-3 py-1 rounded text-sm"
                    style={{ 
                      backgroundColor: theme.colors.secondary,
                      color: theme.colors.background
                    }}
                  >
                    Secondary
                  </div>
                </div>
                
                <div 
                  className="p-3 rounded text-sm"
                  style={{ backgroundColor: theme.colors.muted }}
                >
                  This is muted background content
                </div>
                
                <div className="flex gap-2">
                  <div 
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      backgroundColor: theme.colors.accent,
                      color: theme.colors.background
                    }}
                  >
                    Accent
                  </div>
                  <div 
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      backgroundColor: theme.colors.destructive,
                      color: theme.colors.background
                    }}
                  >
                    Destructive
                  </div>
                  <div 
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      backgroundColor: theme.colors.warning,
                      color: theme.colors.background
                    }}
                  >
                    Warning
                  </div>
                  <div 
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      backgroundColor: theme.colors.success,
                      color: theme.colors.background
                    }}
                  >
                    Success
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}