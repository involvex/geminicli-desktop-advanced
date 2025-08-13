use tauri::{AppHandle, State};
use backend::{ProcessStatus, DirEntry, RecentChat, ProjectsResponse, EnrichedProject, 
              SearchResult, SearchFilters};
use backend::servers::Server;
use crate::state::AppState;
use crate::settings::AppSettings;

#[tauri::command]
pub async fn check_cli_installed(state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.check_cli_installed().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_session(
    session_id: String, 
    working_directory: Option<String>,
    model: Option<String>,
    state: State<'_, AppState>
) -> Result<(), String> {
    if let Some(working_directory) = working_directory {
        let model = model.unwrap_or_else(|| "gemini-2.0-flash-exp".to_string());
        state.backend.initialize_session(session_id, working_directory, model).await
            .map_err(|e| e.to_string())
    } else {
        let available = state.backend.check_cli_installed().await.map_err(|e| e.to_string())?;
        if available {
            Ok(())
        } else {
            Err("Gemini CLI not available".to_string())
        }
    }
}

#[tauri::command]
pub async fn send_message(
    session_id: String,
    message: String,
    conversation_history: String,
    model: Option<String>,
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _ = model;
    state.backend.send_message(session_id, message, conversation_history)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_gemini_command() -> Result<String, String> {
    use tokio::process::Command;
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
pub async fn get_process_statuses(state: State<'_, AppState>) -> Result<Vec<ProcessStatus>, String> {
    state.backend.get_process_statuses().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_process(conversation_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.backend.kill_process(&conversation_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_tool_call_confirmation_response(
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
pub async fn execute_confirmed_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.backend.execute_confirmed_command(command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_conversation_title(
    message: String,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.backend.generate_conversation_title(message, model)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.validate_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_home_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.backend.is_home_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_home_directory(state: State<'_, AppState>) -> Result<String, String> {
    state.backend.get_home_directory().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_parent_directory(path: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    state.backend.get_parent_directory(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_directory_contents(path: String, state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    state.backend.list_directory_contents(path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_volumes(state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    state.backend.list_volumes().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_chats(state: State<'_, AppState>) -> Result<Vec<RecentChat>, String> {
    state.backend.get_recent_chats().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_chats(
    query: String, 
    filters: Option<SearchFilters>, 
    state: State<'_, AppState>
) -> Result<Vec<SearchResult>, String> {
    state.backend.search_chats(query, filters).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(limit: Option<u32>, offset: Option<u32>, state: State<'_, AppState>) -> Result<ProjectsResponse, String> {
    let lim = limit.unwrap_or(25);
    let off = offset.unwrap_or(0);
    state.backend.list_projects(lim, off).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_enriched_projects(state: State<'_, AppState>) -> Result<Vec<EnrichedProject>, String> {
    state.backend.list_enriched_projects().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project(sha256: String, external_root_path: String, state: State<'_, AppState>) -> Result<EnrichedProject, String> {
    state.backend.get_enriched_project(sha256, external_root_path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_project_discussions(project_id: String, state: State<'_, AppState>) -> Result<Vec<RecentChat>, String> {
    state.backend.get_project_discussions(&project_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn debug_environment() -> Result<String, String> {
    let path = std::env::var("PATH").unwrap_or_else(|_| "PATH not found".to_string());
    let home = std::env::var("HOME").unwrap_or_else(|_| {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "HOME not found".to_string())
    });

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

#[tauri::command]
pub async fn list_servers() -> Result<Vec<Server>, String> {
    backend::servers::list_servers().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_server(
    name: String,
    port: u16,
    model: String,
    working_directory: Option<String>,
) -> Result<Vec<Server>, String> {
    let server = backend::servers::Server::new(name, port, model, working_directory.unwrap_or_default());
    backend::servers::add_server(server).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn edit_server(
    id: String,
    name: String,
    port: u16,
    model: String,
    working_directory: String,
) -> Result<Vec<Server>, String> {
    let server = backend::servers::Server {
        id,
        name,
        port,
        model,
        working_directory,
        status: "stopped".to_string(), // Status is managed by backend
        pid: None, // PID is managed by backend
    };
    backend::servers::edit_server(server).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_server(id: String) -> Result<Vec<Server>, String> {
    backend::servers::delete_server(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_server(id: String) -> Result<Vec<Server>, String> {
    backend::servers::start_server(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_server(id: String) -> Result<Vec<Server>, String> {
    backend::servers::stop_server(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    Ok(crate::settings::load_settings())
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings, app_handle: AppHandle) -> Result<(), String> {
    crate::settings::save_settings(&settings).map_err(|e| e.to_string())?;
    
    // Re-register hotkeys with new settings
    crate::hotkeys::register_hotkeys(&app_handle, &settings);
    
    Ok(())
}

#[tauri::command]
pub async fn take_screenshot() -> Result<String, String> {
    // This would integrate with a screenshot library
    // For now, just return a placeholder
    Ok("Screenshot functionality not yet implemented".to_string())
}

#[tauri::command]
pub async fn import_file() -> Result<String, String> {
    // This would open a file dialog and import the selected file
    // For now, just return a placeholder
    Ok("File import functionality not yet implemented".to_string())
}