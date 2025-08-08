#![allow(clippy::used_underscore_binding)]
use tauri::{AppHandle, Emitter, Manager, State};
use serde::Serialize;
use std::sync::Arc;

// Import backend functionality
use backend::{
    EventEmitter, GeminiBackend,
    ProcessStatus, DirEntry, RecentChat,
    ProjectsResponse, EnrichedProject,
    SearchResult, SearchFilters,
};

// =====================================
// Tauri EventEmitter Implementation
// =====================================

/// Wrapper around Tauri's AppHandle that implements EventEmitter
#[derive(Clone)]
pub struct TauriEventEmitter {
    app_handle: AppHandle,
}

impl TauriEventEmitter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
}

impl EventEmitter for TauriEventEmitter {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> backend::BackendResult<()> {
        self.app_handle
            .emit(event, payload)
            .map_err(|_e| backend::BackendError::ChannelError)?;
        Ok(())
    }
}

// =====================================
// Application State
// =====================================

struct AppState {
    backend: Arc<GeminiBackend<TauriEventEmitter>>,
}



// =====================================
// Tauri Commands (Thin Wrappers)
// =====================================

#[tauri::command]
async fn check_cli_installed(state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.check_cli_installed().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_session(
    session_id: String, 
    working_directory: Option<String>,
    model: Option<String>,
    state: State<'_, AppState>
) -> Result<(), String> {
    // If working_directory is provided, initialize a session with that directory
    if let Some(working_directory) = working_directory {
        let model = model.unwrap_or_else(|| "gemini-2.0-flash-exp".to_string());
        state.backend.initialize_session(session_id, working_directory, model).await
            .map_err(|e| e.to_string())
    } else {
        // For compatibility with existing frontend, just check if CLI is installed
        let available = state.backend.check_cli_installed().await.map_err(|e| e.to_string())?;
        if available {
            Ok(())
        } else {
            Err("Gemini CLI not available".to_string())
        }
    }
}

#[tauri::command]
async fn send_message(
    session_id: String,
    message: String,
    conversation_history: String,
    model: Option<String>,
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Without working directory UI, we do not auto-initialize sessions here.
    // If a session is needed, user flows elsewhere should handle initialization, or backend will error gracefully.
    let _ = model; // suppress unused warning
    state.backend.send_message(session_id, message, conversation_history)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_gemini_command() -> Result<String, String> {
    use tokio::process::Command;
    // Test running gemini with --help using shell
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "gemini", "--help"])
            .output()
            .await
            .map_err(|e| format!("Failed to run gemini --help via cmd: {e}"))?
    } else {
        Command::new("sh")
            .args(["-c", "gemini --help"])
            .output()
            .await
            .map_err(|e| format!("Failed to run gemini --help via shell: {e}"))?
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    Ok(format!(
        "Running 'gemini --help' via shell\nExit code: {}\nSTDOUT:\n{}\nSTDERR:\n{}",
        output.status.code().unwrap_or(-1),
        stdout,
        stderr
    ))
}

#[tauri::command]
async fn get_process_statuses(state: State<'_, AppState>) -> Result<Vec<ProcessStatus>, String> {
    state.backend.get_process_statuses().map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_process(conversation_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.backend.kill_process(&conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_tool_call_confirmation_response(
    session_id: String,
    request_id: u32,
    tool_call_id: String,
    outcome: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.backend.handle_tool_confirmation(session_id, request_id, tool_call_id, outcome)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_confirmed_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.backend.execute_confirmed_command(command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_conversation_title(
    message: String,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.backend.generate_conversation_title(message, model)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn validate_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.validate_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_home_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.is_home_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_home_directory(state: State<'_, AppState>) -> Result<String, String> {
    state.backend.get_home_directory().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_parent_directory(path: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    state.backend.get_parent_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_directory_contents(path: String, state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    state.backend.list_directory_contents(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_volumes(state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    state.backend.list_volumes().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_recent_chats(state: State<'_, AppState>) -> Result<Vec<RecentChat>, String> {
    state.backend.get_recent_chats().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_chats(
    query: String, 
    filters: Option<SearchFilters>, 
    state: State<'_, AppState>
) -> Result<Vec<SearchResult>, String> {
    state.backend.search_chats(query, filters).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_projects(limit: Option<u32>, offset: Option<u32>, state: State<'_, AppState>) -> Result<ProjectsResponse, String> {
    let lim = limit.unwrap_or(25);
    let off = offset.unwrap_or(0);
    state.backend.list_projects(lim, off).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_enriched_projects(state: State<'_, AppState>) -> Result<Vec<EnrichedProject>, String> {
    state.backend.list_enriched_projects().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_project(sha256: String, external_root_path: String, state: State<'_, AppState>) -> Result<EnrichedProject, String> {
    state.backend.get_enriched_project(sha256, external_root_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_project_discussions(project_id: String, state: State<'_, AppState>) -> Result<Vec<RecentChat>, String> {
    state.backend.get_project_discussions(&project_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn debug_environment() -> Result<String, String> {
    let path = std::env::var("PATH").unwrap_or_else(|_| "PATH not found".to_string());
    let home = std::env::var("HOME").unwrap_or_else(|_| {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "HOME not found".to_string())
    });

    // Test if gemini is available via shell
    let gemini_result = if cfg!(target_os = "windows") {
        match tokio::process::Command::new("cmd")
            .args(["/C", "gemini", "--version"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                format!(
                    "Available via shell: {}",
                    String::from_utf8_lossy(&output.stdout).trim()
                )
            }
            Ok(output) => {
                format!(
                    "Shell test failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )
            }
            Err(e) => format!("Shell execution failed: {e}"),
        }
    } else {
        match tokio::process::Command::new("sh")
            .args(["-c", "gemini --version"])
            .output()
            .await
        {
            Ok(output) if output.status.success() => {
                format!(
                    "Available via shell: {}",
                    String::from_utf8_lossy(&output.stdout).trim()
                )
            }
            Ok(output) => {
                format!(
                    "Shell test failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )
            }
            Err(e) => format!("Shell execution failed: {e}"),
        }
    };

    // Get the actual system PATH using cmd
    let system_path = if cfg!(windows) {
        match tokio::process::Command::new("cmd")
            .args(["/c", "echo %PATH%"])
            .output()
            .await
        {
            Ok(output) => String::from_utf8_lossy(&output.stdout).to_string(),
            Err(e) => format!("Failed to get system PATH: {e}"),
        }
    } else {
        "Not Windows".to_string()
    };

    Ok(format!(
        "Current PATH (from Tauri app):\n{}\n\nSystem PATH (from cmd):\n{}\n\nHOME: {}\n\nGemini CLI test result:\n{}",
        path.replace(';', ";\n").replace(':', ":\n"),
        system_path.replace(';', ";\n").replace(':', ":\n"),
        home,
        gemini_result
    ))
}

// =====================================
// Main Application Entry Point
// =====================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // This will be called on app startup to initialize the backend
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Create the backend with Tauri event emitter
            let emitter = TauriEventEmitter::new(app.handle().clone());
            let backend = GeminiBackend::new(emitter);
            
            // Store in app state
            let app_state = AppState {
                backend: Arc::new(backend),
            };
            app.manage(app_state);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_cli_installed,
            start_session,
            send_message,
            get_process_statuses,
            kill_process,
            test_gemini_command,
            send_tool_call_confirmation_response,
            execute_confirmed_command,
            generate_conversation_title,
            validate_directory,
            is_home_directory,
            get_home_directory,
            get_parent_directory,
            list_directory_contents,
            list_volumes,
            debug_environment,
            get_recent_chats,
            search_chats,
            list_projects,
            list_enriched_projects,
            get_project,
            get_project_discussions
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}