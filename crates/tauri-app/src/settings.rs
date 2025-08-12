use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SettingsLocation {
    ProjectRoot,
    Global,
    User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub settings_location: SettingsLocation,
    pub hotkeys: HotkeySettings,
    pub ui: UiSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeySettings {
    pub quick_open: String,
    pub toggle_chat: String,
    pub screenshot: String,
    pub import_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiSettings {
    pub start_minimized: bool,
    pub close_to_tray: bool,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            settings_location: SettingsLocation::User,
            hotkeys: HotkeySettings::default(),
            ui: UiSettings::default(),
        }
    }
}

impl Default for HotkeySettings {
    fn default() -> Self {
        Self {
            quick_open: "Ctrl+Shift+G".to_string(),
            toggle_chat: "Ctrl+Shift+C".to_string(),
            screenshot: "Ctrl+Shift+S".to_string(),
            import_file: "Ctrl+Shift+I".to_string(),
        }
    }
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            start_minimized: false,
            close_to_tray: true,
            theme: "dark".to_string(),
        }
    }
}

pub fn get_settings_path(location: &SettingsLocation) -> Result<PathBuf, Box<dyn std::error::Error>> {
    match location {
        SettingsLocation::ProjectRoot => {
            let current_dir = std::env::current_dir()?;
            Ok(current_dir.join("gemini-desktop-settings.json"))
        }
        SettingsLocation::Global => {
            if cfg!(windows) {
                Ok(PathBuf::from("C:\\ProgramData\\GeminiDesktop\\settings.json"))
            } else {
                Ok(PathBuf::from("/etc/gemini-desktop/settings.json"))
            }
        }
        SettingsLocation::User => {
            let home = dirs::home_dir().ok_or("Could not find home directory")?;
            Ok(home.join(".gemini-desktop").join("settings.json"))
        }
    }
}

pub fn load_settings() -> AppSettings {
    // Try to load from user location first
    if let Ok(settings) = load_settings_from(&SettingsLocation::User) {
        return settings;
    }
    
    // Try project root
    if let Ok(settings) = load_settings_from(&SettingsLocation::ProjectRoot) {
        return settings;
    }
    
    // Try global
    if let Ok(settings) = load_settings_from(&SettingsLocation::Global) {
        return settings;
    }
    
    // Return default if none found
    AppSettings::default()
}

fn load_settings_from(location: &SettingsLocation) -> Result<AppSettings, Box<dyn std::error::Error>> {
    let path = get_settings_path(location)?;
    let content = fs::read_to_string(path)?;
    let settings: AppSettings = serde_json::from_str(&content)?;
    Ok(settings)
}

pub fn save_settings(settings: &AppSettings) -> Result<(), Box<dyn std::error::Error>> {
    let path = get_settings_path(&settings.settings_location)?;
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(path, content)?;
    Ok(())
}