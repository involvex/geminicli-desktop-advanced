use tauri::{AppHandle, Runtime};
use crate::settings::AppSettings;

pub fn register_hotkeys<R: Runtime>(_app: &AppHandle<R>, settings: &AppSettings) {
    println!("Hotkeys configured:");
    println!("  Quick Open: {}", settings.hotkeys.quick_open);
    println!("  Toggle Chat: {}", settings.hotkeys.toggle_chat);
    println!("  Screenshot: {}", settings.hotkeys.screenshot);
    println!("  Import File: {}", settings.hotkeys.import_file);
}

