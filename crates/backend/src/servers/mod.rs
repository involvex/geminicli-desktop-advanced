use crate::types::{BackendError, BackendResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    pub id: String,
    pub name: String,
    pub port: u16,
    pub model: String,
    pub working_directory: String,
    #[serde(default)]
    pub status: String, // "running", "stopped", "error"
    #[serde(default)]
    pub pid: Option<u32>,
}

fn get_servers_path() -> BackendResult<PathBuf> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| BackendError::ConfigError("Could not determine home directory".to_string()))?;
    Ok(PathBuf::from(home)
        .join(".gemini-desktop")
        .join("servers.json"))
}

pub fn list_servers() -> BackendResult<Vec<Server>> {
    let path = get_servers_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(path).map_err(BackendError::IoError)?;
    let servers: Vec<Server> =
        serde_json::from_str(&content).map_err(|e| BackendError::JsonError(e.to_string()))?;
    Ok(servers)
}

impl Server {
    pub fn new(name: String, port: u16, model: String, working_directory: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            port,
            model,
            working_directory,
            status: "stopped".to_string(),
            pid: None,
        }
    }
}

pub fn add_server(server: Server) -> BackendResult<Vec<Server>> {
    println!("DEBUG: add_server called with: {:?}", server); // Debug print
    let path = get_servers_path()?;
    // Ensure the parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(BackendError::IoError)?;
    }
    println!("DEBUG: servers.json path: {:?}", path); // Debug print

    let mut servers = if path.exists() {
        let content = fs::read_to_string(&path).map_err(BackendError::IoError)?;
        println!("DEBUG: Existing servers.json content: {}", content); // Debug print
        if content.is_empty() {
            vec![]
        } else {
            serde_json::from_str(&content).map_err(|e| {
                println!("ERROR: JSON deserialization failed: {}", e); // Debug print
                BackendError::JsonError(e.to_string())
            })?
        }
    } else {
        println!("DEBUG: servers.json does not exist, initializing empty list."); // Debug print
        vec![]
    };

    // Check for duplicate server name or port
    if servers.iter().any(|s: &Server| s.name == server.name) {
        println!("ERROR: Server with name '{}' already exists.", server.name); // Debug print
        return Err(BackendError::ConfigError(
            "A server with this name already exists.".to_string(),
        ));
    }
    if servers.iter().any(|s: &Server| s.port == server.port) {
        println!("ERROR: Server with port '{}' already exists.", server.port); // Debug print
        return Err(BackendError::ConfigError(
            "A server with this port already exists.".to_string(),
        ));
    }

    servers.push(server);

    let content = serde_json::to_string_pretty(&servers)
        .map_err(|e| {
            println!("ERROR: JSON serialization failed: {}", e); // Debug print
            BackendError::JsonError(e.to_string())
        })?;
    println!("DEBUG: New servers.json content to write: {}", content); // Debug print
    fs::write(&path, content).map_err(|e| { // Use &path here
        println!("ERROR: File write failed: {}", e); // Debug print
        BackendError::IoError(e)
    })?;

    println!("DEBUG: Server added successfully."); // Debug print
    Ok(servers)
}

pub fn edit_server(updated_server: Server) -> BackendResult<Vec<Server>> {
    let path = get_servers_path()?;
    let mut servers: Vec<Server> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(BackendError::IoError)?;
        if content.is_empty() {
            vec![]
        } else {
            serde_json::from_str(&content).map_err(|e| BackendError::JsonError(e.to_string()))?
        }
    } else {
        return Err(BackendError::ConfigError(
            "No servers configured.".to_string(),
        ));
    };

    // FIX E0502: Check for duplicate name or port before iterating
    if servers
        .iter()
        .any(|s: &Server| s.id != updated_server.id && s.name == updated_server.name)
    {
        return Err(BackendError::ConfigError(
            "A server with this name already exists.".to_string(),
        ));
    }
    if servers
        .iter()
        .any(|s: &Server| s.id != updated_server.id && s.port == updated_server.port)
    {
        return Err(BackendError::ConfigError(
            "A server with this port already exists.".to_string(),
        ));
    }

    let mut found = false;
    for server in servers.iter_mut() {
        if server.id == updated_server.id {
            *server = updated_server;
            found = true;
            break;
        }
    }

    if !found {
        return Err(BackendError::ConfigError("Server not found.".to_string()));
    }

    let content = serde_json::to_string_pretty(&servers)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    fs::write(path, content).map_err(BackendError::IoError)?;

    Ok(servers)
}

pub fn delete_server(id: String) -> BackendResult<Vec<Server>> {
    let path = get_servers_path()?;
    let mut servers: Vec<Server> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(BackendError::IoError)?;
        if content.is_empty() {
            vec![]
        } else {
            serde_json::from_str(&content).map_err(|e| BackendError::JsonError(e.to_string()))?
        }
    } else {
        return Err(BackendError::ConfigError(
            "No servers configured.".to_string(),
        ));
    };

    let initial_len = servers.len();
    servers.retain(|s| s.id != id);

    if servers.len() == initial_len {
        return Err(BackendError::ConfigError("Server not found.".to_string()));
    }

    let content = serde_json::to_string_pretty(&servers)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    fs::write(path, content).map_err(BackendError::IoError)?;

    Ok(servers)
}

pub async fn start_server(id: String) -> BackendResult<Vec<Server>> {
    let path = get_servers_path()?;
    let mut servers: Vec<Server> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(BackendError::IoError)?;
        if content.is_empty() {
            vec![]
        } else {
            serde_json::from_str(&content).map_err(|e| BackendError::JsonError(e.to_string()))?
        }
    } else {
        return Err(BackendError::ConfigError(
            "No servers configured.".to_string(),
        ));
    };

    let mut found_index = None;
    for (i, server) in servers.iter_mut().enumerate() {
        if server.id == id {
            if server.status == "running" {
                return Err(BackendError::ConfigError(
                    "Server is already running.".to_string(),
                ));
            }
            found_index = Some(i);
            break;
        }
    }

    let index =
        found_index.ok_or_else(|| BackendError::ConfigError("Server not found.".to_string()))?;
    let server_to_start = &mut servers[index];

    // Spawn the gemini CLI process
    let mut cmd = {
        #[cfg(target_os = "windows")]
        {
            let mut c = Command::new("cmd");
            c.args([
                "/C",
                "gemini",
                "--experimental-acp",
                "--model",
                &server_to_start.model,
            ]);
            c
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut c = Command::new("sh");
            let gemini_command = format!(
                "gemini --experimental-acp --model {}",
                server_to_start.model
            );
            c.args(["-c", &gemini_command]);
            c
        }
    };

    if !server_to_start.working_directory.is_empty() {
        cmd.current_dir(&server_to_start.working_directory);
    }
    
    // Set ACP_PORT environment variable
    cmd.env("ACP_PORT", server_to_start.port.to_string());

    let child = cmd.spawn().map_err(|e| {
        BackendError::CommandExecutionFailed(format!("Failed to start server process: {}", e))
    })?;
    let pid = child.id().ok_or_else(|| {
        BackendError::ConfigError("Failed to get PID of spawned process.".to_string())
    })?;

    server_to_start.status = "running".to_string();
    server_to_start.pid = Some(pid);

    let content = serde_json::to_string_pretty(&servers)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    fs::write(path, content).map_err(BackendError::IoError)?;

    Ok(servers)
}

pub async fn stop_server(id: String) -> BackendResult<Vec<Server>> {
    let path = get_servers_path()?;
    let mut servers: Vec<Server> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(BackendError::IoError)?;
        if content.is_empty() {
            vec![]
        } else {
            serde_json::from_str(&content).map_err(|e| BackendError::JsonError(e.to_string()))?
        }
    } else {
        return Err(BackendError::ConfigError(
            "No servers configured.".to_string(),
        ));
    };

    let mut found_index = None;
    for (i, server) in servers.iter_mut().enumerate() {
        if server.id == id {
            if server.status == "stopped" {
                return Err(BackendError::ConfigError(
                    "Server is already stopped.".to_string(),
                ));
            }
            if let Some(pid) = server.pid {
                #[cfg(windows)]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F"])
                        .output()
                        .map_err(|e| {
                            BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process: {e}"
                            ))
                        })?;

                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                        let stderr_lower = stderr.to_lowercase();
                        if stderr_lower.contains("not found") {
                            // Consider the process already gone
                        } else {
                            return Err(BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process {}: {}",
                                pid, stderr
                            )));
                        }
                    }
                }

                #[cfg(not(windows))]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output()
                        .map_err(|e| {
                            BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process: {e}"
                            ))
                        })?;

                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                        let stderr_lower = stderr.to_lowercase();
                        if stderr_lower.contains("no such process") {
                            // Consider the process already gone
                        } else {
                            return Err(BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process {}: {}",
                                pid, stderr
                            )));
                        }
                    }
                }
            }
            server.status = "stopped".to_string();
            server.pid = None;
            found_index = Some(i);
            break;
        }
    }

    if found_index.is_none() {
        return Err(BackendError::ConfigError("Server not found.".to_string()));
    }

    let content = serde_json::to_string_pretty(&servers)
        .map_err(|e| BackendError::JsonError(e.to_string()))?;
    fs::write(path, content).map_err(BackendError::IoError)?;

    Ok(servers)
}
