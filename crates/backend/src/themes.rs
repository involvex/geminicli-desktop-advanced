use crate::types::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub background: String,
    pub foreground: String,
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub muted: String,
    pub border: String,
    pub card: String,
    pub popover: String,
    pub destructive: String,
    pub warning: String,
    pub success: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTheme {
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: String,
    pub colors: ThemeColors,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemePreset {
    pub name: String,
    pub description: String,
    pub colors: ThemeColors,
}

/// Get the themes directory path
fn get_themes_dir() -> BackendResult<PathBuf> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| BackendError::IoError(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Could not find home directory"
        )))?;
    
    let themes_dir = home_dir.join(".gemini-desktop").join("themes");
    
    if !themes_dir.exists() {
        fs::create_dir_all(&themes_dir)
            .map_err(BackendError::IoError)?;
    }
    
    Ok(themes_dir)
}

/// Save a custom theme
pub async fn save_theme(theme: CustomTheme) -> BackendResult<()> {
    let themes_dir = get_themes_dir()?;
    let theme_file = themes_dir.join(format!("{}.json", theme.name.replace(' ', "_").to_lowercase()));
    
    let theme_json = serde_json::to_string_pretty(&theme)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    
    fs::write(theme_file, theme_json)
        .map_err(BackendError::IoError)?;
    
    Ok(())
}

/// Load a custom theme by name
pub async fn load_theme(name: &str) -> BackendResult<CustomTheme> {
    let themes_dir = get_themes_dir()?;
    let theme_file = themes_dir.join(format!("{}.json", name.replace(' ', "_").to_lowercase()));
    
    let theme_json = fs::read_to_string(theme_file)
        .map_err(BackendError::IoError)?;
    
    let theme: CustomTheme = serde_json::from_str(&theme_json)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    
    Ok(theme)
}

/// List all custom themes
pub async fn list_themes() -> BackendResult<Vec<String>> {
    let themes_dir = get_themes_dir()?;
    let mut themes = Vec::new();
    
    if let Ok(entries) = fs::read_dir(themes_dir) {
        for entry in entries.flatten() {
            if let Some(file_name) = entry.file_name().to_str() {
                if file_name.ends_with(".json") {
                    let theme_name = file_name.trim_end_matches(".json");
                    themes.push(theme_name.replace('_', " "));
                }
            }
        }
    }
    
    themes.sort();
    Ok(themes)
}

/// Delete a custom theme
pub async fn delete_theme(name: &str) -> BackendResult<()> {
    let themes_dir = get_themes_dir()?;
    let theme_file = themes_dir.join(format!("{}.json", name.replace(' ', "_").to_lowercase()));
    
    fs::remove_file(theme_file)
        .map_err(BackendError::IoError)?;
    
    Ok(())
}

/// Get built-in theme presets
pub fn get_theme_presets() -> Vec<ThemePreset> {
    vec![
        ThemePreset {
            name: "Dark".to_string(),
            description: "Classic dark theme".to_string(),
            colors: ThemeColors {
                background: "#0a0a0a".to_string(),
                foreground: "#fafafa".to_string(),
                primary: "#fafafa".to_string(),
                secondary: "#262626".to_string(),
                accent: "#f4f4f5".to_string(),
                muted: "#171717".to_string(),
                border: "#262626".to_string(),
                card: "#0a0a0a".to_string(),
                popover: "#0a0a0a".to_string(),
                destructive: "#dc2626".to_string(),
                warning: "#f59e0b".to_string(),
                success: "#16a34a".to_string(),
            },
        },
        ThemePreset {
            name: "Light".to_string(),
            description: "Clean light theme".to_string(),
            colors: ThemeColors {
                background: "#ffffff".to_string(),
                foreground: "#0a0a0a".to_string(),
                primary: "#171717".to_string(),
                secondary: "#f4f4f5".to_string(),
                accent: "#0a0a0a".to_string(),
                muted: "#f4f4f5".to_string(),
                border: "#e4e4e7".to_string(),
                card: "#ffffff".to_string(),
                popover: "#ffffff".to_string(),
                destructive: "#dc2626".to_string(),
                warning: "#f59e0b".to_string(),
                success: "#16a34a".to_string(),
            },
        },
        ThemePreset {
            name: "Blue".to_string(),
            description: "Professional blue theme".to_string(),
            colors: ThemeColors {
                background: "#0f172a".to_string(),
                foreground: "#f1f5f9".to_string(),
                primary: "#3b82f6".to_string(),
                secondary: "#1e293b".to_string(),
                accent: "#60a5fa".to_string(),
                muted: "#1e293b".to_string(),
                border: "#334155".to_string(),
                card: "#0f172a".to_string(),
                popover: "#0f172a".to_string(),
                destructive: "#ef4444".to_string(),
                warning: "#f59e0b".to_string(),
                success: "#10b981".to_string(),
            },
        },
        ThemePreset {
            name: "Green".to_string(),
            description: "Nature-inspired green theme".to_string(),
            colors: ThemeColors {
                background: "#0f1419".to_string(),
                foreground: "#ecfdf5".to_string(),
                primary: "#10b981".to_string(),
                secondary: "#1f2937".to_string(),
                accent: "#34d399".to_string(),
                muted: "#1f2937".to_string(),
                border: "#374151".to_string(),
                card: "#0f1419".to_string(),
                popover: "#0f1419".to_string(),
                destructive: "#ef4444".to_string(),
                warning: "#f59e0b".to_string(),
                success: "#10b981".to_string(),
            },
        },
        ThemePreset {
            name: "Purple".to_string(),
            description: "Creative purple theme".to_string(),
            colors: ThemeColors {
                background: "#1e1b4b".to_string(),
                foreground: "#f3f4f6".to_string(),
                primary: "#8b5cf6".to_string(),
                secondary: "#312e81".to_string(),
                accent: "#a78bfa".to_string(),
                muted: "#312e81".to_string(),
                border: "#4c1d95".to_string(),
                card: "#1e1b4b".to_string(),
                popover: "#1e1b4b".to_string(),
                destructive: "#ef4444".to_string(),
                warning: "#f59e0b".to_string(),
                success: "#10b981".to_string(),
            },
        },
    ]
}

/// Generate CSS from theme colors
pub fn generate_theme_css(colors: &ThemeColors) -> String {
    format!(
        r#":root {{
  --background: {};
  --foreground: {};
  --primary: {};
  --secondary: {};
  --accent: {};
  --muted: {};
  --border: {};
  --card: {};
  --popover: {};
  --destructive: {};
  --warning: {};
  --success: {};
}}"#,
        colors.background,
        colors.foreground,
        colors.primary,
        colors.secondary,
        colors.accent,
        colors.muted,
        colors.border,
        colors.card,
        colors.popover,
        colors.destructive,
        colors.warning,
        colors.success,
    )
}

/// Export theme as CSS file
pub async fn export_theme_css(theme: &CustomTheme, output_path: &str) -> BackendResult<()> {
    let css_content = generate_theme_css(&theme.colors);
    
    fs::write(output_path, css_content)
        .map_err(BackendError::IoError)?;
    
    Ok(())
}