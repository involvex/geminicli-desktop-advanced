#![allow(clippy::used_underscore_binding)]

mod event_emitter;
mod state;
mod commands;

use std::sync::Arc;
use backend::GeminiBackend;
use event_emitter::TauriEventEmitter;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let emitter = TauriEventEmitter::new(app.handle().clone());
            let backend = GeminiBackend::new(emitter);
            
            let app_state = AppState {
                backend: Arc::new(backend),
            };
            app.manage(app_state);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_cli_installed,
            commands::start_session,
            commands::send_message,
            commands::get_process_statuses,
            commands::kill_process,
            commands::test_gemini_command,
            commands::send_tool_call_confirmation_response,
            commands::execute_confirmed_command,
            commands::generate_conversation_title,
            commands::validate_directory,
            commands::is_home_directory,
            commands::get_home_directory,
            commands::get_parent_directory,
            commands::list_directory_contents,
            commands::list_volumes,
            commands::debug_environment,
            commands::get_recent_chats,
            commands::search_chats,
            commands::list_projects,
            commands::list_enriched_projects,
            commands::get_project,
            commands::get_project_discussions,
            commands::list_servers,
            commands::add_server,
            commands::edit_server,
            commands::delete_server,
            commands::start_server,
            commands::stop_server
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}