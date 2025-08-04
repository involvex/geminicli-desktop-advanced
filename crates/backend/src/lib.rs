use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;

// =====================================
// Internal Event Communication System
// =====================================

/// Internal events that need to be forwarded to the frontend
#[derive(Debug, Clone)]
pub enum InternalEvent {
    CliIo {
        session_id: String,
        payload: CliIoPayload,
    },
    GeminiOutput {
        session_id: String,
        payload: GeminiOutputPayload,
    },
    GeminiThought {
        session_id: String,
        payload: GeminiThoughtPayload,
    },
    ToolCall {
        session_id: String,
        payload: ToolCallEvent,
    },
    ToolCallUpdate {
        session_id: String,
        payload: ToolCallUpdate,
    },
    ToolCallConfirmation {
        session_id: String,
        payload: ToolCallConfirmationRequest,
    },
    GeminiTurnFinished {
        session_id: String,
    },
    Error {
        session_id: String,
        payload: ErrorPayload,
    },
}

// =====================================
// Generic Event System
// =====================================

/// Generic event emitter trait that abstracts away frontend-specific event systems
pub trait EventEmitter: Send + Sync + Clone {
    /// Emit a generic event with payload
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> BackendResult<()>;
}

/// CLI I/O event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliIoPayload {
    #[serde(rename = "type")]
    pub io_type: CliIoType,
    pub data: String,
}

/// CLI I/O event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CliIoType {
    Input,
    Output,
}

/// Gemini text output payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiOutputPayload {
    pub text: String,
}

/// Gemini thought payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiThoughtPayload {
    pub thought: String,
}

/// Error event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub error: String,
}

/// Tool call event data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEvent {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
    pub status: String,
}

/// Tool call update data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallUpdate {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

/// Tool call confirmation request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallConfirmationRequest {
    pub request_id: u32,
    pub session_id: String,
    pub label: String,
    pub icon: String,
    pub content: Option<ToolCallConfirmationContent>,
    pub confirmation: ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

// =====================================
// JSON-RPC Protocol Types
// =====================================

/// JSON-RPC 2.0 request structure  
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u32,
    pub method: String,
    pub params: serde_json::Value,
}

/// JSON-RPC 2.0 response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u32,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 2.0 error structure
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

// =====================================
// Gemini CLI Protocol Types
// =====================================

/// Parameters for sending user message to Gemini CLI
#[derive(Debug, Serialize, Deserialize)]
pub struct SendUserMessageParams {
    pub chunks: Vec<MessageChunk>,
}

/// Message chunk - can be text or file path
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageChunk {
    Text { text: String },
    Path { path: String },
}

/// Parameters for streaming assistant message chunks
#[derive(Debug, Serialize, Deserialize)]
pub struct StreamAssistantMessageChunkParams {
    pub chunk: AssistantChunk,
}

/// Assistant response chunk containing thought and/or text
#[derive(Debug, Serialize, Deserialize)]
pub struct AssistantChunk {
    pub thought: Option<String>,
    pub text: Option<String>,
}

/// Parameters for pushing tool call information
#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallParams {
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
}

/// Result returned when pushing a tool call
#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallResult {
    pub id: u32,
}

/// Parameters for updating tool call status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateToolCallParams {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

/// Parameters for requesting tool call confirmation
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationParams {
    pub label: String,
    pub icon: String,
    pub content: Option<ToolCallConfirmationContent>,
    pub confirmation: ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

/// Result returned from tool call confirmation
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationResult {
    pub id: String,
    pub outcome: String,
}

// =====================================
// Core Types (extracted from Tauri app)
// =====================================

/// Tool call location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallLocation {
    pub path: String,
}

/// Tool call confirmation content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmationContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(rename = "oldText", default)]
    pub old_text: Option<String>,
    #[serde(rename = "newText", default)]
    pub new_text: Option<String>,
}

/// Tool call confirmation details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmation {
    #[serde(rename = "type")]
    pub confirmation_type: String,
    #[serde(rename = "rootCommand", default)]
    pub root_command: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
}

// =====================================
// RPC Logging System
// =====================================

/// Trait for logging RPC messages
pub trait RpcLogger: Send + Sync {
    /// Log an RPC message with timestamp
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error>;
}

/// Generates SHA256 hash of a project directory path
pub struct ProjectHasher;

impl ProjectHasher {
    /// Generate SHA256 hash of the canonical path
    pub fn hash_path(path: &str) -> BackendResult<String> {
        let canonical_path = std::path::Path::new(path)
            .canonicalize()
            .map_err(|e| BackendError::IoError(e))?;

        let mut hasher = Sha256::new();
        hasher.update(canonical_path.to_string_lossy().as_bytes());
        let hash = format!("{:x}", hasher.finalize());
        Ok(hash)
    }
}

/// File-based RPC logger implementation
pub struct FileRpcLogger {
    writer: Arc<Mutex<BufWriter<File>>>,
    file_path: std::path::PathBuf,
}

impl FileRpcLogger {
    /// Create a new file-based RPC logger
    pub fn new(working_directory: Option<&str>) -> BackendResult<Self> {
        // Determine project directory
        let project_dir = working_directory.map(|s| s.to_string()).unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .to_string_lossy()
                .to_string()
        });

        // Generate project hash
        let project_hash = ProjectHasher::hash_path(&project_dir)?;

        // Create log directory structure
        let home_dir = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

        let log_dir = std::path::Path::new(&home_dir)
            .join(".gemini-desktop")
            .join("projects")
            .join(&project_hash);

        fs::create_dir_all(&log_dir).map_err(|e| BackendError::IoError(e))?;

        // Create log file with timestamp
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        let log_filename = format!("rpc-log-{}.log", timestamp);
        let file_path = log_dir.join(log_filename);

        // Open file for writing
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| BackendError::IoError(e))?;

        let writer = Arc::new(Mutex::new(BufWriter::new(file)));

        Ok(Self { writer, file_path })
    }

    /// Clean up old log files (older than 30 days)
    pub fn cleanup_old_logs(&self) -> Result<(), std::io::Error> {
        let parent_dir = self.file_path.parent().unwrap();
        let cutoff_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            - (30 * 24 * 60 * 60); // 30 days

        if let Ok(entries) = fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                if let Some(filename) = entry.file_name().to_str() {
                    if filename.starts_with("rpc-log-") && filename.ends_with(".log") {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(modified) = metadata.modified() {
                                if let Ok(modified_secs) =
                                    modified.duration_since(std::time::UNIX_EPOCH)
                                {
                                    if modified_secs.as_secs() < cutoff_time {
                                        let _ = fs::remove_file(entry.path());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

impl RpcLogger for FileRpcLogger {
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error> {
        let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let log_line = format!("[{}] {}\n", timestamp, message);

        if let Ok(mut writer) = self.writer.lock() {
            writer.write_all(log_line.as_bytes())?;
            writer.flush()?;
        }

        Ok(())
    }
}

/// Dummy RPC logger that does nothing (fallback)
pub struct NoOpRpcLogger;

impl RpcLogger for NoOpRpcLogger {
    fn log_rpc(&self, _message: &str) -> Result<(), std::io::Error> {
        Ok(())
    }
}

// =====================================
// Security Functions
// =====================================

/// Check if a command is safe to execute by validating against dangerous patterns
/// and ensuring it starts with a known safe command
#[allow(clippy::too_many_lines)]
pub fn is_command_safe(command: &str) -> bool {
    let dangerous_patterns = [
        "rm ",
        "del ",
        "format",
        "mkfs",
        "dd if=",
        "sudo rm",
        "sudo del",
        "> /dev/",
        "curl ",
        "wget ",
        "powershell",
        "cmd /c del",
        "cmd /c rd",
        "shutdown",
        "reboot",
        "halt",
        "init 0",
        "systemctl",
        "service ",
        "apt-get remove",
        "yum remove",
        "dnf remove",
        "brew uninstall",
        "npm uninstall -g",
        "pip uninstall",
        "cargo uninstall",
        "chmod 777",
        "chown ",
        "passwd",
        "su ",
        "sudo su",
        "export PATH=",
        "set PATH=",
        "alias rm=",
        "alias del=",
        "eval ",
        "exec ",
        "`",
        "$(",
        "${",
        "||",
        "&&",
        "; rm",
        "; del",
        "; sudo",
        "; curl",
        "; wget",
        "| rm",
        "| del",
        "| sudo",
        "| curl",
        "| wget",
    ];

    let command_lower = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if command_lower.contains(pattern) {
            return false;
        }
    }

    // Allow common safe commands
    let safe_commands = [
        "echo",
        "cat",
        "ls",
        "dir",
        "pwd",
        "whoami",
        "date",
        "time",
        "python",
        "node",
        "npm",
        "cargo",
        "git",
        "rustc",
        "gcc",
        "clang",
        "java",
        "javac",
        "go",
        "php",
        "ruby",
        "perl",
        "make",
        "cmake",
        "grep",
        "find",
        "sort",
        "head",
        "tail",
        "wc",
        "awk",
        "sed",
        "ping",
        "nslookup",
        "dig",
        "ps",
        "top",
        "htop",
        "df",
        "du",
        "uname",
        "which",
        "where",
        "type",
        "help",
        "man",
        "--help",
        "--version",
    ];

    let first_word = command_lower.split_whitespace().next().unwrap_or("");
    safe_commands
        .iter()
        .any(|&safe_cmd| first_word.starts_with(safe_cmd))
}

/// Execute a terminal command safely after validation
pub async fn execute_terminal_command(command: &str) -> BackendResult<String> {
    if !is_command_safe(command) {
        return Err(BackendError::CommandNotAllowed);
    }

    println!("🖥️ Executing terminal command: {command}");

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", command]).output().await
    } else {
        Command::new("sh").args(["-c", command]).output().await
    };

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);

            if result.status.success() {
                Ok(format!(
                    "Exit code: {}\nOutput:\n{}",
                    result.status.code().unwrap_or(0),
                    stdout
                ))
            } else {
                Err(BackendError::CommandExecutionFailed(format!(
                    "Exit code: {}\nError:\n{}\nOutput:\n{}",
                    result.status.code().unwrap_or(-1),
                    stderr,
                    stdout
                )))
            }
        }
        Err(e) => Err(BackendError::CommandExecutionFailed(format!(
            "Failed to execute command: {e}"
        ))),
    }
}

// =====================================
// Session Management
// =====================================

/// Persistent CLI session state
pub struct PersistentSession {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
    pub stdin: Option<ChildStdin>,
    pub message_sender: Option<mpsc::UnboundedSender<String>>,
    pub rpc_logger: Arc<dyn RpcLogger>,
    pub child: Option<Child>,
}

/// Public process status (serializable for external use)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessStatus {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
}

/// Volume/drive type for better icon selection
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VolumeType {
    LocalDisk,
    RemovableDisk,
    NetworkDrive,
    CdDrive,
    RamDisk,
    FileSystem, // For Unix root filesystem
}

/// Directory entry for listing directory contents
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub full_path: String,
    pub size: Option<u64>,
    pub modified: Option<u64>, // Unix timestamp
    pub is_symlink: bool,
    pub symlink_target: Option<String>, // The target path if this is a symlink
    pub volume_type: Option<VolumeType>, // Type of volume (for drives/volumes only)
}

impl From<&PersistentSession> for ProcessStatus {
    fn from(session: &PersistentSession) -> Self {
        Self {
            conversation_id: session.conversation_id.clone(),
            pid: session.pid,
            created_at: session.created_at,
            is_alive: session.is_alive,
        }
    }
}

/// Type alias for the process map
pub type ProcessMap = Arc<Mutex<HashMap<String, PersistentSession>>>;

/// Recent chat summary returned to the web client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentChat {
    pub id: String,
    pub title: String,
    pub started_at_iso: String,
    pub message_count: u32,
}

/// Session manager that handles all active CLI sessions
pub struct SessionManager {
    processes: ProcessMap,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get all process statuses
    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        let processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        let statuses = processes.values().map(ProcessStatus::from).collect();

        Ok(statuses)
    }

    /// Kill a process by conversation ID
    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        if let Some(session) = processes.get_mut(conversation_id) {
            // Prefer graceful kill via stored Child handle.
            if let Some(mut child) = session.child.take() {
                let _ = child.kill();
            } else if let Some(pid) = session.pid {
                // Kill the process
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
                        return Err(BackendError::CommandExecutionFailed(format!(
                            "Failed to kill process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        )));
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
                        return Err(BackendError::CommandExecutionFailed(format!(
                            "Failed to kill process {}: {}",
                            pid,
                            String::from_utf8_lossy(&output.stderr)
                        )));
                    }
                }
            }

            // Clean up session
            session.is_alive = false;
            session.pid = None;
            session.stdin = None;
            session.message_sender = None;
        }

        Ok(())
    }

    /// Get the process map (for internal use)
    pub(crate) fn get_processes(&self) -> &ProcessMap {
        &self.processes
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// =====================================
// CLI Process Management & I/O Handling
// =====================================

/// Initialize a new persistent session with the Gemini CLI
pub async fn initialize_session<E: EventEmitter + 'static>(
    session_id: String,
    working_directory: String,
    model: String,
    emitter: E,
    session_manager: &SessionManager,
) -> BackendResult<(mpsc::UnboundedSender<String>, Arc<dyn RpcLogger>)> {
    println!("🚀 Initializing persistent Gemini session for: {session_id}");

    // Create RPC logger for this specific project/working directory
    let rpc_logger: Arc<dyn RpcLogger> = match FileRpcLogger::new(Some(&working_directory)) {
        Ok(logger) => {
            println!("📝 RPC logging enabled for session: {session_id}");
            // Clean up old logs
            let _ = logger.cleanup_old_logs();
            Arc::new(logger)
        }
        Err(e) => {
            println!("⚠️  Failed to create RPC logger for session {session_id}: {e}");
            // Fallback to no-op logger if file logger creation fails
            Arc::new(NoOpRpcLogger)
        }
    };

    // Create message channel for sending messages to this session
    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();

    // Build the command with OS-specific launcher
    let mut cmd = {
        #[cfg(target_os = "windows")]
        {
            let mut c = Command::new("cmd");
            c.args(["/C", "gemini", "--model", &model, "--experimental-acp"]);
            c
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut c = Command::new("sh");
            let gemini_command = format!("gemini --model {model} --experimental-acp");
            c.args(["-c", &gemini_command]);
            c
        }
    };

    // Pipe stdio on the Command (before spawn)
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set working directory on Command
    if !working_directory.is_empty() {
        println!("🗂️ Setting working directory to: {working_directory}");
        cmd.current_dir(&working_directory);
    }

    // Now spawn to obtain a Child
    let mut child = cmd.spawn().map_err(|e| {
        #[cfg(target_os = "windows")]
        {
            BackendError::SessionInitFailed(format!("Failed to run gemini command via cmd: {e}"))
        }
        #[cfg(not(target_os = "windows"))]
        {
            BackendError::SessionInitFailed(format!("Failed to run gemini command via shell: {e}"))
        }
    })?;

    let pid = child.id();
    let mut stdin = child.stdin.take().ok_or(BackendError::SessionInitFailed(
        "Failed to get stdin".to_string(),
    ))?;
    let stdout = child.stdout.take().ok_or(BackendError::SessionInitFailed(
        "Failed to get stdout".to_string(),
    ))?;

    // Initialize the CLI session
    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "initialize".to_string(),
        params: serde_json::json!({
            "protocolVersion": "0.0.9"
        }),
    };

    let request_json = serde_json::to_string(&init_request).map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to serialize init request: {e}"))
    })?;

    // Log the RPC message
    let _ = rpc_logger.log_rpc(&request_json);

    // Send initialization
    stdin
        .write_all(request_json.as_bytes())
        .await
        .map_err(|e| {
            BackendError::SessionInitFailed(format!("Failed to write init request: {e}"))
        })?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to write newline: {e}")))?;
    stdin
        .flush()
        .await
        .map_err(|e| BackendError::SessionInitFailed(format!("Failed to flush: {e}")))?;

    // Emit CLI input event
    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Input,
            data: request_json.clone(),
        },
    );

    // Read initialization response
    let mut reader = AsyncBufReader::new(stdout);
    let mut line = String::new();
    reader.read_line(&mut line).await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to read init response: {e}"))
    })?;

    // Log the RPC response
    let _ = rpc_logger.log_rpc(line.trim());

    // Emit CLI output event
    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Output,
            data: line.trim().to_string(),
        },
    );

    // Parse initialization response
    match serde_json::from_str::<JsonRpcResponse>(&line) {
        Ok(response) => {
            if let Some(error) = &response.error {
                return Err(BackendError::SessionInitFailed(format!(
                    "Gemini CLI Error: {error:?}"
                )));
            }
            println!("✅ Session initialized successfully for: {session_id}");
        }
        Err(e) => {
            return Err(BackendError::SessionInitFailed(format!(
                "Failed to parse init response: {e}"
            )));
        }
    }

    // Store the session
    {
        let processes = session_manager.get_processes();
        let mut processes = processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;
        processes.insert(
            session_id.clone(),
            PersistentSession {
                conversation_id: session_id.clone(),
                pid,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                is_alive: true,
                stdin: Some(stdin),
                message_sender: Some(message_tx.clone()),
                rpc_logger: rpc_logger.clone(),
                child: Some(child),
            },
        );
    }

    // Create event channel for internal communication
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<InternalEvent>();

    // Spawn task to handle event forwarding to frontend
    let session_id_for_events = session_id.clone();
    tokio::spawn(async move {
        while let Some(internal_event) = event_rx.recv().await {
            println!("internal_event: {internal_event:?}");
            match internal_event {
                InternalEvent::CliIo {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("cli-io-{session_id}"), payload);
                }
                InternalEvent::GeminiOutput {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("gemini-output-{session_id}"), payload.text);
                }
                InternalEvent::GeminiThought {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("gemini-thought-{session_id}"), payload.thought);
                }
                InternalEvent::ToolCall {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("gemini-tool-call-{session_id}"), payload);
                }
                InternalEvent::ToolCallUpdate {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("gemini-tool-call-update-{session_id}"), payload);
                }
                InternalEvent::ToolCallConfirmation {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(
                        &format!("gemini-tool-call-confirmation-{session_id}"),
                        payload,
                    );
                }
                InternalEvent::GeminiTurnFinished { session_id } => {
                    let _ = emitter.emit(&format!("gemini-turn-finished-{session_id}"), true);
                }
                InternalEvent::Error {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("gemini-error-{session_id}"), payload.error);
                }
            }
        }
        println!("🔄 Event forwarding task finished for session: {session_id_for_events}");
    });

    // Spawn task to handle this session's I/O
    let session_id_clone = session_id.clone();
    let processes_clone = session_manager.get_processes().clone();

    tokio::spawn(async move {
        handle_session_io_internal(
            session_id_clone,
            reader,
            message_rx,
            processes_clone,
            event_tx,
        )
        .await;
    });

    Ok((message_tx, rpc_logger))
}

/// Internal I/O handler with event communication channel
async fn handle_session_io_internal(
    session_id: String,
    mut reader: AsyncBufReader<ChildStdout>,
    mut message_rx: mpsc::UnboundedReceiver<String>,
    processes: ProcessMap,
    event_tx: mpsc::UnboundedSender<InternalEvent>,
) {
    let mut tool_call_id = 1001u32;
    let mut pending_send_message_requests = HashSet::<u32>::new();

    loop {
        tokio::select! {
            // Handle incoming messages to send to CLI
            message = message_rx.recv() => {
                if let Some(message_json) = message {
                    // Get stdin from the session
                    let stdin_opt = {
                        let mut processes_guard = processes.lock().unwrap();
                        if let Some(session) = processes_guard.get_mut(&session_id) {
                            session.stdin.take()
                        } else {
                            None
                        }
                    };

                    if let Some(mut stdin) = stdin_opt {
                        // Check if this is a sendUserMessage request and track it
                        if let Ok(json_request) = serde_json::from_str::<JsonRpcRequest>(&message_json) {
                            if json_request.method == "sendUserMessage" {
                                pending_send_message_requests.insert(json_request.id);
                            }
                        }

                        // Log the RPC message being sent
                        if let Ok(processes_guard) = processes.lock() {
                            if let Some(session) = processes_guard.get(&session_id) {
                                let _ = session.rpc_logger.log_rpc(&message_json);
                            }
                        }

                        // Emit CLI input event for EVERY message sent to CLI
                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Input,
                                data: message_json.clone(),
                            },
                        });

                        // Send the message
                        if let Err(e) = stdin.write_all(message_json.as_bytes()).await {
                            println!("❌ Failed to write message: {e}");
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            println!("❌ Failed to write newline: {e}");
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            println!("❌ Failed to flush: {e}");
                            break;
                        }

                        // Put stdin back
                        {
                            let mut processes_guard = processes.lock().unwrap();
                            if let Some(session) = processes_guard.get_mut(&session_id) {
                                session.stdin = Some(stdin);
                            }
                        }
                    } else {
                        println!("❌ No stdin available for session: {session_id}");
                        break;
                    }
                } else {
                    // Channel closed
                    break;
                }
            }

            // Handle CLI output
            line_result = async {
                let mut line = String::new();
                let result = reader.read_line(&mut line).await;
                (result, line)
            } => {
                match line_result {
                    (Ok(0), _) => {
                        break;
                    }
                    (Ok(_), line) => {
                        let line = line.trim();
                        if line.is_empty() || !line.starts_with('{') {
                            continue;
                        }

                        // Log the RPC message received
                        if let Ok(processes_guard) = processes.lock() {
                            if let Some(session) = processes_guard.get(&session_id) {
                                let _ = session.rpc_logger.log_rpc(line);
                            }
                        }

                        // Emit CLI output event for EVERY message received from CLI
                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Output,
                                data: line.to_string(),
                            },
                        });


                        // Handle JSON-RPC requests from CLI
                        if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(line) {
                            handle_cli_request_internal(request, &session_id, &processes, &mut tool_call_id, &event_tx).await;
                        }
                        // Handle JSON-RPC responses
                        else if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(line) {
                            if let Some(error) = &response.error {
                                println!("❌ CLI Error: {error:?}");
                            }
                            // Check if this is a completion response (result: null) for a sendUserMessage request
                            else if response.result.is_none() && pending_send_message_requests.contains(&response.id) {
                                    pending_send_message_requests.remove(&response.id);
                                    let _ = event_tx.send(InternalEvent::GeminiTurnFinished {
                                        session_id: session_id.clone(),
                                    });

                            }
                        }
                    }
                    (Err(e), _) => {
                        println!("❌ Error reading from CLI: {e}");
                        break;
                    }
                }
            }
        }
    }

    // Cleanup
    {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(&session_id) {
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        }
    }

    println!("✅ Session I/O handler finished for: {session_id}");
}

/// Internal CLI request handler with event communication channel
async fn handle_cli_request_internal(
    request: JsonRpcRequest,
    session_id: &str,
    processes: &ProcessMap,
    tool_call_id: &mut u32,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
) {
    match request.method.as_str() {
        "streamAssistantMessageChunk" => {
            if let Ok(params) =
                serde_json::from_value::<StreamAssistantMessageChunkParams>(request.params.clone())
            {
                if let Some(thought) = params.chunk.thought {
                    println!("💭 Received thought chunk: {thought}");
                    let _ = event_tx.send(InternalEvent::GeminiThought {
                        session_id: session_id.to_string(),
                        payload: GeminiThoughtPayload { thought },
                    });
                }
                if let Some(text) = params.chunk.text {
                    println!("📝 Received text chunk: {text}");
                    let _ = event_tx.send(InternalEvent::GeminiOutput {
                        session_id: session_id.to_string(),
                        payload: GeminiOutputPayload { text },
                    });
                }
            } else {
                println!(
                    "❌ Failed to parse streamAssistantMessageChunk params: {:?}",
                    request.params
                );
            }
        }
        "pushToolCall" => {
            if let Ok(params) = serde_json::from_value::<PushToolCallParams>(request.params) {
                let tool_name = match params.icon.as_str() {
                    "folder" => "list_directory",
                    "fileSearch" => "read_file",
                    "search" => "search_files",
                    "terminal" => "execute_command",
                    "code" => "write_file",
                    _ => &params.icon,
                };

                *tool_call_id += 1;
                let tool_id = *tool_call_id;

                // Send response back to CLI
                send_response_to_cli_internal(
                    session_id,
                    request.id,
                    Some(serde_json::to_value(PushToolCallResult { id: tool_id }).unwrap()),
                    None,
                    processes,
                    event_tx,
                )
                .await;

                // Emit tool call event to frontend
                let tool_call_event = ToolCallEvent {
                    id: tool_id,
                    name: tool_name.to_string(),
                    icon: params.icon.clone(),
                    label: params.label.clone(),
                    locations: params.locations.clone(),
                    status: "running".to_string(),
                };
                let _ = event_tx.send(InternalEvent::ToolCall {
                    session_id: session_id.to_string(),
                    payload: tool_call_event,
                });
                println!("📋 Tool call: {tool_name} (ID: {tool_id})");
            }
        }
        "updateToolCall" => {
            let params = serde_json::from_value::<UpdateToolCallParams>(request.params).unwrap();
            // Send null response
            send_response_to_cli_internal(
                session_id,
                request.id,
                Some(serde_json::Value::Null),
                None,
                processes,
                event_tx,
            )
            .await;

            // Emit tool call update event to frontend
            let tool_call_update = ToolCallUpdate {
                tool_call_id: params.tool_call_id,
                status: params.status.clone(),
                content: params.content.clone(),
            };
            let _ = event_tx.send(InternalEvent::ToolCallUpdate {
                session_id: session_id.to_string(),
                payload: tool_call_update,
            });
            println!(
                "updateToolCall: tool_call_id={}, status={}",
                params.tool_call_id, params.status
            );
        }
        "requestToolCallConfirmation" => {
            if let Ok(params) =
                serde_json::from_value::<RequestToolCallConfirmationParams>(request.params)
            {
                println!("🔍 Tool call confirmation request: {}", params.label);
                // Emit tool call confirmation request to frontend
                let confirmation_request = ToolCallConfirmationRequest {
                    request_id: request.id,
                    session_id: session_id.to_string(),
                    label: params.label.clone(),
                    icon: params.icon.clone(),
                    content: params.content.clone(),
                    confirmation: params.confirmation.clone(),
                    locations: params.locations.clone(),
                };
                let _ = event_tx.send(InternalEvent::ToolCallConfirmation {
                    session_id: session_id.to_string(),
                    payload: confirmation_request,
                });
            }
        }
        _ => {
            println!("❓ Unknown CLI method: {}", request.method);
        }
    }
}

/// Send a JSON-RPC response back to the CLI (internal version)
async fn send_response_to_cli_internal(
    session_id: &str,
    request_id: u32,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
    processes: &ProcessMap,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: request_id,
        result,
        error,
    };

    let response_json = serde_json::to_string(&response).unwrap();

    // Log the RPC response being sent
    if let Ok(processes_guard) = processes.lock() {
        if let Some(session) = processes_guard.get(session_id) {
            let _ = session.rpc_logger.log_rpc(&response_json);
        }
    }

    // Emit CLI input event for response we're sending back to CLI
    let _ = event_tx.send(InternalEvent::CliIo {
        session_id: session_id.to_string(),
        payload: CliIoPayload {
            io_type: CliIoType::Input,
            data: response_json.clone(),
        },
    });

    // Get stdin and send response
    let stdin_opt = {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(session_id) {
            session.stdin.take()
        } else {
            None
        }
    };

    if let Some(mut stdin) = stdin_opt {
        let _ = stdin.write_all(response_json.as_bytes()).await;
        let _ = stdin.write_all(b"\n").await;
        let _ = stdin.flush().await;

        // Put stdin back
        {
            let mut processes_guard = processes.lock().unwrap();
            if let Some(session) = processes_guard.get_mut(session_id) {
                session.stdin = Some(stdin);
            }
        }
    }
}

// =====================================
// Error Types
// =====================================

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Command not allowed for security reasons")]
    CommandNotAllowed,

    #[error("Failed to execute command: {0}")]
    CommandExecutionFailed(String),

    #[error("Failed to serialize/deserialize: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Session initialization failed: {0}")]
    SessionInitFailed(String),

    #[error("Channel communication failed")]
    ChannelError,
}

pub type BackendResult<T> = Result<T, BackendError>;

// =====================================
// Projects Listing Types and Helpers
// =====================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>, // active | error | unknown
    #[serde(skip_serializing_if = "Option::is_none", rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastActivityAt")]
    pub last_activity_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "logCount")]
    pub log_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectsResponse {
    pub items: Vec<ProjectListItem>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

fn home_projects_root() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));
    if home.is_empty() {
        return None;
    }
    Some(Path::new(&home).join(".gemini-desktop").join("projects"))
}

// Extract the ISO timestamp inside [ ... ] prefix. Returns None if not found or invalid.
fn extract_prefix_iso(line: &str) -> Option<String> {
    let start = line.find('[')?;
    let end = line.find(']')?;
    if end <= start + 1 {
        return None;
    }
    let ts = &line[start + 1..end];
    // Basic sanity: must end with 'Z' and contain 'T'
    if !ts.ends_with('Z') || !ts.contains('T') {
        return None;
    }
    Some(ts.to_string())
}

// Count message stats and derive title/status by scanning lines.
fn analyze_log_file(
    path: &Path,
) -> (
    u32,            /*user*/
    u32,            /*assistant*/
    u32,            /*thoughts*/
    Option<String>, /*firstUserTitle*/
    Option<String>, /*earliest*/
    Option<String>, /*latest*/
    bool,           /*parseErr*/
) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0, 0, None, None, None, true),
    };
    let reader = std::io::BufReader::new(file);
    let mut user_msgs = 0u32;
    let mut assistant_msgs = 0u32;
    let mut thoughts = 0u32;
    let mut first_user_title: Option<String> = None;
    let mut earliest_iso: Option<String> = None;
    let mut latest_iso: Option<String> = None;
    let mut parse_error = false;

    let mut user_message_ids: HashSet<u64> = HashSet::new();

    for line in reader.lines().filter_map(|l| l.ok()) {
        // Track timestamps (keep working logic)
        if let Some(iso) = extract_prefix_iso(&line) {
            if earliest_iso.is_none() {
                earliest_iso = Some(iso.clone());
            }
            latest_iso = Some(iso);
        }
        
        // Parse JSON (keep existing approach)
        let json_start = match line.find('{') {
            Some(i) => i,
            None => continue,
        };
        let json_str = &line[json_start..];
        let val: serde_json::Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(_) => {
                parse_error = true;
                continue;
            }
        };
        
        let method = val.get("method").and_then(|m| m.as_str()).unwrap_or("");
        
        if method == "sendUserMessage" {
            user_msgs = user_msgs.saturating_add(1);
            
            // Track this request ID for assistant response counting
            if let Some(id) = val.get("id").and_then(|i| i.as_u64()) {
                user_message_ids.insert(id);
            }
            
            if first_user_title.is_none() {
                if let Some(params) = val.get("params") {
                    if let Some(chunks) = params.get("chunks").and_then(|c| c.as_array()) {
                        let combined = chunks
                            .iter()
                            .filter_map(|ch| ch.get("text").and_then(|t| t.as_str()))
                            .collect::<Vec<_>>()
                            .join(" ");
                        let trimmed = combined.trim();
                        if !trimmed.is_empty() {
                            let words: Vec<&str> = trimmed.split_whitespace().take(6).collect();
                            if !words.is_empty() {
                                first_user_title = Some(words.join(" "));
                            }
                        }
                    }
                }
            }
        } else if method == "streamAssistantMessageChunk" {
            // Thought counting (keep existing - it was correct)
            if let Some(params) = val.get("params") {
                if params
                    .get("chunk")
                    .and_then(|c| c.get("thought"))
                    .and_then(|t| t.as_str())
                    .is_some()
                {
                    thoughts = thoughts.saturating_add(1);
                }
            }
        }
        
        if let Some(result) = val.get("result") {
            if result.is_null() {
                if let Some(id) = val.get("id").and_then(|i| i.as_u64()) {
                    if user_message_ids.contains(&id) {
                        assistant_msgs = assistant_msgs.saturating_add(1);
                    }
                }
            }
        }
        
        // Error detection (keep existing logic)
        if val.get("error").is_some() {
            parse_error = true;
        }
    }

    (
        user_msgs,
        assistant_msgs,
        thoughts,
        first_user_title,
        earliest_iso,
        latest_iso,
        parse_error,
    )
}

fn parse_millis_from_log_name(name: &str) -> Option<u64> {
    // Accept rpc-log-<millis>.log or .json
    if !name.starts_with("rpc-log-") {
        return None;
    }
    let rest = name.strip_prefix("rpc-log-")?;
    let ts_part = rest.strip_suffix(".log").or_else(|| rest.strip_suffix(".json"))?;
    ts_part.parse::<u64>().ok()
}

/// Enumerate projects and return a paginated ProjectsResponse (fast path).
pub fn list_projects(limit: u32, offset: u32) -> BackendResult<ProjectsResponse> {
    let Some(root) = home_projects_root() else {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    };
    if !root.exists() || !root.is_dir() {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    }

    // Collect all 64-hex directories
    let mut all_ids: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root).map_err(BackendError::IoError)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
            if name.len() == 64 && name.chars().all(|c| c.is_ascii_hexdigit()) {
                all_ids.push(name.to_string());
            }
        }
    }
    all_ids.sort();

    let total = all_ids.len() as u32;
    let start = std::cmp::min(offset as usize, all_ids.len());
    let end = std::cmp::min(start + limit as usize, all_ids.len());
    let page_ids = &all_ids[start..end];

    // Build items (lightweight)
    let mut items: Vec<ProjectListItem> = Vec::new();
    for id in page_ids {
        let proj_path = root.join(id);

        // Enumerate only filenames to compute counts and timestamps. Do not open files.
        let mut log_count: u32 = 0;
        let mut earliest_ts_millis: Option<u64> = None;
        let mut latest_ts_millis: Option<u64> = None;
        let mut latest_mtime_secs: Option<u64> = None;

        if let Ok(rd) = fs::read_dir(&proj_path) {
            for e in rd.flatten() {
                let p = e.path();
                let fname_opt = p.file_name().and_then(|s| s.to_str());
                if let Some(fname) = fname_opt {
                    if fname.starts_with("rpc-log-") && (fname.ends_with(".log") || fname.ends_with(".json")) {
                        log_count = log_count.saturating_add(1);

                        // Prefer timestamp embedded in filename for created/updated derivation
                        if let Some(millis) = parse_millis_from_log_name(fname) {
                            earliest_ts_millis = match earliest_ts_millis {
                                Some(cur) => Some(cur.min(millis)),
                                None => Some(millis),
                            };
                            latest_ts_millis = match latest_ts_millis {
                                Some(cur) => Some(cur.max(millis)),
                                None => Some(millis),
                            };
                        }

                        // Also track latest mtime as fallback for lastActivity
                        if let Ok(md) = e.metadata() {
                            if let Ok(modified) = md.modified() {
                                if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                                    let secs = dur.as_secs();
                                    latest_mtime_secs = Some(latest_mtime_secs.map_or(secs, |cur| cur.max(secs)));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Compute created/updated/lastActivity as ISO strings
        let created_at_iso: Option<String> = earliest_ts_millis.map(|ms| {
            // millis -> seconds
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let updated_at_iso_from_name: Option<String> = latest_ts_millis.map(|ms| {
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let last_activity_iso_from_mtime: Option<String> = latest_mtime_secs.map(|secs| {
            chrono::DateTime::<chrono::Utc>::from(std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs))
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        // Prefer filename-derived updatedAt; fallback to mtime-derived last activity
        let updated_at_iso = updated_at_iso_from_name.clone().or_else(|| last_activity_iso_from_mtime.clone());
        let last_activity_iso = updated_at_iso_from_name.or(last_activity_iso_from_mtime);

        // Title: avoid opening files. Provide None to keep fast path.
        // Frontend renders gracefully without title.
        let title: Option<String> = None;

        // Status: "active" if there is any log; otherwise "unknown"
        let status = if log_count > 0 { "active".to_string() } else { "unknown".to_string() };

        items.push(ProjectListItem {
            id: id.clone(),
            title,
            status: Some(status),
            created_at: created_at_iso,
            updated_at: updated_at_iso.clone(),
            last_activity_at: last_activity_iso,
            log_count: Some(log_count),
        });
    }

    Ok(ProjectsResponse {
        items,
        total,
        limit,
        offset,
    })
}

// Duplicated older block removed to resolve conflicts.

// (removed older duplicate block)

// =====================================
// Public API (to be implemented)
// =====================================

/// Main backend interface for Gemini CLI functionality
pub struct GeminiBackend<E: EventEmitter> {
    emitter: E,
    session_manager: SessionManager,
    next_request_id: Arc<Mutex<u32>>,
}

impl<E: EventEmitter + 'static> GeminiBackend<E> {
    /// Create a new GeminiBackend instance
    pub fn new(emitter: E) -> Self {
        Self {
            emitter,
            session_manager: SessionManager::new(),
            next_request_id: Arc::new(Mutex::new(1000)),
        }
    }

    // =====================================
    // Event Helper Methods
    // =====================================

    /// Emit CLI I/O event
    pub fn emit_cli_io(
        &self,
        session_id: &str,
        io_type: CliIoType,
        data: &str,
    ) -> BackendResult<()> {
        let payload = CliIoPayload {
            io_type,
            data: data.to_string(),
        };
        self.emitter.emit(&format!("cli-io-{session_id}"), payload)
    }

    /// Emit Gemini output event
    pub fn emit_gemini_output(&self, session_id: &str, text: &str) -> BackendResult<()> {
        let payload = GeminiOutputPayload {
            text: text.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-output-{session_id}"), payload)
    }

    /// Emit Gemini thought event
    pub fn emit_gemini_thought(&self, session_id: &str, thought: &str) -> BackendResult<()> {
        let payload = GeminiThoughtPayload {
            thought: thought.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-thought-{session_id}"), payload)
    }

    /// Emit tool call event
    pub fn emit_tool_call(&self, session_id: &str, tool_call: &ToolCallEvent) -> BackendResult<()> {
        self.emitter
            .emit(&format!("gemini-tool-call-{session_id}"), tool_call.clone())
    }

    /// Emit tool call update event
    pub fn emit_tool_call_update(
        &self,
        session_id: &str,
        update: &ToolCallUpdate,
    ) -> BackendResult<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-update-{session_id}"),
            update.clone(),
        )
    }

    /// Emit tool call confirmation event
    pub fn emit_tool_call_confirmation(
        &self,
        session_id: &str,
        confirmation: &ToolCallConfirmationRequest,
    ) -> BackendResult<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-confirmation-{session_id}"),
            confirmation.clone(),
        )
    }

    /// Emit error event
    pub fn emit_error(&self, session_id: &str, error: &str) -> BackendResult<()> {
        let payload = ErrorPayload {
            error: error.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-error-{session_id}"), payload)
    }

    /// Emit command result event
    pub fn emit_command_result(&self, result: &CommandResult) -> BackendResult<()> {
        self.emitter.emit("command-result", result.clone())
    }

    /// Extract chat data from log file.
    fn extract_chat_data(log_path: Option<std::path::PathBuf>) -> (u32, Option<String>) {
        use std::io::BufRead;

        let log_path = match log_path {
            Some(path) => path,
            None => return (0, None),
        };

        let file = match std::fs::File::open(&log_path) {
            Ok(file) => file,
            Err(_) => return (0, None),
        };

        let reader = std::io::BufReader::new(file);
        let mut message_count: u32 = 0;
        let mut first_user_text = None;

        for line in reader.lines().filter_map(|l| l.ok()) {
            let json_str = match line.find('{') {
                Some(idx) => &line[idx..],
                None => continue,
            };

            let req: JsonRpcRequest = match serde_json::from_str(json_str) {
                Ok(req) => req,
                Err(_) => continue,
            };

            if req.method == "sendUserMessage" {
                message_count = message_count.saturating_add(1);

                if first_user_text.is_none() {
                    first_user_text = Self::extract_first_user_text(req.params);
                }
            }
        }

        (message_count, first_user_text)
    }

    /// Extract first user text from message parameters.
    fn extract_first_user_text(params: serde_json::Value) -> Option<String> {
        let params: SendUserMessageParams = serde_json::from_value(params).ok()?;

        let combined = params
            .chunks
            .into_iter()
            .filter_map(|ch| match ch {
                MessageChunk::Text { text } => Some(text),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(" ");

        if combined.is_empty() {
            return None;
        }

        let words: Vec<&str> = combined.split_whitespace().take(6).collect();
        if words.is_empty() {
            None
        } else {
            Some(words.join(" "))
        }
    }

    /// Return the last 3 chats globally by scanning all rpc-log-*.log files under ~/.gemini-desktop/projects.
    /// Each log file is treated as a distinct chat entry (no grouping by project).
    pub async fn get_recent_chats(&self) -> BackendResult<Vec<RecentChat>> {
        use std::ffi::OsStr;
        use std::time::{SystemTime, UNIX_EPOCH};

        // Resolve projects root
        let home = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));
        if home.is_empty() {
            return Err(BackendError::SessionInitFailed(
                "Could not determine home directory".to_string(),
            ));
        }
        let projects_dir = std::path::Path::new(&home)
            .join(".gemini-desktop")
            .join("projects");
        if !projects_dir.exists() || !projects_dir.is_dir() {
            return Ok(vec![]);
        }

        // Collect one RecentChat per log file across all project hash folders
        let mut chats: Vec<RecentChat> = Vec::new();

        let projects_iter = match std::fs::read_dir(&projects_dir) {
            Ok(e) => e,
            Err(e) => return Err(BackendError::IoError(e)),
        };

        for proj_dir_entry in projects_iter {
            let proj_dir_entry = match proj_dir_entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let proj_path = proj_dir_entry.path();
            if !proj_path.is_dir() {
                continue;
            }

            let project_hash = match proj_path.file_name().and_then(OsStr::to_str) {
                Some(s) => s.to_string(),
                None => continue,
            };

            // Enumerate rpc-log-*.log in this project folder
            let logs_iter = match std::fs::read_dir(&proj_path) {
                Ok(l) => l,
                Err(_) => continue,
            };

            for log_entry in logs_iter {
                let log_entry = match log_entry {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                let log_path = log_entry.path();
                let Some(name) = log_path.file_name().and_then(OsStr::to_str) else {
                    continue;
                };

                // Select only files named rpc-log-*.log
                if !(name.starts_with("rpc-log-") && name.ends_with(".log")) {
                    continue;
                }

                // Per-log metadata for timestamp
                let modified_time = match std::fs::metadata(&log_path).and_then(|md| md.modified())
                {
                    Ok(m) => m,
                    Err(_) => SystemTime::now(),
                };
                let started_secs = modified_time
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let started_iso = chrono::DateTime::<chrono::Utc>::from(
                    UNIX_EPOCH + std::time::Duration::from_secs(started_secs),
                )
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

                // Extract message_count and first user text from this specific log file
                let (message_count, first_user_text) =
                    Self::extract_chat_data(Some(log_path.clone()));

                // Title generation (same rules as before but per-log)
                let title = if let Some(t) = first_user_text.clone() {
                    let t = t.trim();
                    if t.is_empty() {
                        format!(
                            "Conversation {}",
                            &project_hash.chars().take(6).collect::<String>()
                        )
                    } else if t.len() > 50 {
                        format!("{}…", &t[..50])
                    } else {
                        t.to_string()
                    }
                } else {
                    format!(
                        "Conversation {}",
                        &project_hash.chars().take(6).collect::<String>()
                    )
                };

                // Per-log unique id: "{project_hash}:{file_name}"
                let id = format!("{}:{}", project_hash, name);

                chats.push(RecentChat {
                    id,
                    title,
                    started_at_iso: started_iso,
                    message_count,
                });
            }
        }

        // Sort globally by recency and take top 3
        chats.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));
        if chats.len() > 3 {
            chats.truncate(3);
        }
        Ok(chats)
    }

    /// Check if Gemini CLI is installed and available
    pub async fn check_cli_installed(&self) -> BackendResult<bool> {
        // Test if gemini command is available via shell
        let result = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--version"])
                .output()
                .await
        } else {
            Command::new("sh")
                .args(["-c", "gemini --version"])
                .output()
                .await
        };

        match result {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    }

    /// Initialize a new Gemini CLI session
    pub async fn initialize_session(
        &self,
        session_id: String,
        working_directory: String,
        model: String,
    ) -> BackendResult<()> {
        // If a session already exists and is alive, reuse it.
        {
            let processes = self.session_manager.get_processes();
            if let Ok(guard) = processes.lock() {
                if let Some(existing) = guard.get(&session_id) {
                    if existing.is_alive {
                        return Ok(());
                    }
                }
            }
        }

        let (_message_tx, _rpc_logger) = initialize_session(
            session_id,
            working_directory,
            model,
            self.emitter.clone(),
            &self.session_manager,
        )
        .await?;
        Ok(())
    }

    /// Send a message to an existing session
    pub async fn send_message(
        &self,
        session_id: String,
        message: String,
        conversation_history: String,
    ) -> BackendResult<()> {
        println!("📤 Sending message to session: {session_id}");

        // Check if session exists, if not initialize it
        let message_sender = {
            let processes = self.session_manager.get_processes();
            let processes = processes.lock().map_err(|_| {
                BackendError::SessionInitFailed("Failed to lock processes".to_string())
            })?;
            processes
                .get(&session_id)
                .map_or_else(|| None, |session| session.message_sender.clone())
        };

        let message_sender = if let Some(sender) = message_sender {
            sender
        } else {
            return Err(BackendError::SessionInitFailed(
                "Session not initialized. Call initialize_session with a working directory to start a persistent Gemini process.".to_string()
            ));
        };

        // Build message chunks
        let mut chunks = vec![MessageChunk::Text { text: message }];

        // Add conversation history as context if present
        if !conversation_history.is_empty() {
            chunks.insert(
                0,
                MessageChunk::Text {
                    text: format!("Previous conversation context:\n{conversation_history}\n\n"),
                },
            );
        }
        let msg_params = SendUserMessageParams { chunks };

        // Generate unique request ID
        let request_id = {
            let mut id_guard = self.next_request_id.lock().unwrap();
            let id = *id_guard;
            *id_guard += 1;
            id
        };

        let msg_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            method: "sendUserMessage".to_string(),
            params: serde_json::to_value(msg_params)?,
        };

        let request_json = serde_json::to_string(&msg_request).map_err(|e| {
            BackendError::SessionInitFailed(format!("Failed to serialize message request: {e}"))
        })?;

        // Send the message through the channel
        message_sender
            .send(request_json)
            .map_err(|_| BackendError::ChannelError)?;

        println!("✅ Message sent to persistent session: {session_id}");
        Ok(())
    }

    /// Handle tool call confirmation response
    pub async fn handle_tool_confirmation(
        &self,
        session_id: String,
        request_id: u32,
        tool_call_id: String,
        outcome: String,
    ) -> BackendResult<()> {
        println!(
            "📤 Sending tool call confirmation response: session={session_id}, request_id={request_id}, tool_call_id={tool_call_id}, outcome={outcome}"
        );

        let response_data = RequestToolCallConfirmationResult {
            id: tool_call_id,
            outcome,
        };

        let dummy_event_tx = {
            let (tx, _rx) = mpsc::unbounded_channel();
            tx
        };
        send_response_to_cli_internal(
            &session_id,
            request_id,
            Some(serde_json::to_value(response_data)?),
            None,
            self.session_manager.get_processes(),
            &dummy_event_tx,
        )
        .await;

        Ok(())
    }

    /// Execute a confirmed command
    pub async fn execute_confirmed_command(&self, command: String) -> BackendResult<String> {
        println!("🖥️ Executing confirmed command: {command}");

        match execute_terminal_command(&command).await {
            Ok(output) => {
                println!("✅ Command executed successfully");

                // Emit command result event
                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: true,
                    output: Some(output.clone()),
                    error: None,
                });

                Ok(output)
            }
            Err(error) => {
                println!("❌ Command execution failed: {error}");

                // Emit command result event
                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: false,
                    output: None,
                    error: Some(error.to_string()),
                });

                Err(error)
            }
        }
    }

    /// Generate a conversation title
    pub async fn generate_conversation_title(
        &self,
        message: String,
        model: Option<String>,
    ) -> BackendResult<String> {
        let prompt = format!(
            "Generate a short, concise title (3-6 words) for a conversation that starts with this user message: \"{}\". Only return the title, nothing else.",
            message.chars().take(200).collect::<String>()
        );

        // Run gemini with specified model using simple direct execution
        let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());

        let mut child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| {
                    BackendError::SessionInitFailed(format!(
                        "Failed to spawn gemini for title generation: {e}"
                    ))
                })?
        } else {
            Command::new("gemini")
                .args(["--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| {
                    BackendError::SessionInitFailed(format!(
                        "Failed to spawn gemini for title generation: {e}"
                    ))
                })?
        };

        // Write prompt to stdin
        if let Some(stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let mut stdin = stdin;
            stdin
                .write_all(prompt.as_bytes())
                .await
                .map_err(|e| BackendError::IoError(e))?;
            stdin
                .shutdown()
                .await
                .map_err(|e| BackendError::IoError(e))?;
        }

        // Wait for completion and get output
        let output = child.wait_with_output().await.map_err(|e| {
            BackendError::SessionInitFailed(format!(
                "Failed to run gemini for title generation: {e}"
            ))
        })?;

        if !output.status.success() {
            let error_msg = format!(
                "Gemini CLI failed with exit code {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr)
            );
            return Err(BackendError::SessionInitFailed(error_msg));
        }

        let raw_output = String::from_utf8_lossy(&output.stdout);

        let title = raw_output
            .trim()
            .lines()
            .last()
            .unwrap_or("New Conversation")
            .trim_matches('"')
            .trim()
            .to_string();

        // Fallback if title is too long or empty
        let final_title = if title.is_empty() || title.len() > 50 {
            let fallback = message.chars().take(30).collect::<String>();
            fallback
        } else {
            title
        };

        Ok(final_title)
    }

    /// Get all process statuses
    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        self.session_manager.get_process_statuses()
    }

    /// Kill a process by conversation ID
    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        self.session_manager.kill_process(conversation_id)
    }

    /// Validate if a directory exists and is accessible
    pub async fn validate_directory(&self, path: String) -> BackendResult<bool> {
        use std::path::Path;
        let path_obj = Path::new(&path);
        Ok(path_obj.exists() && path_obj.is_dir())
    }

    /// Check if the given path is the user's home directory
    pub async fn is_home_directory(&self, path: String) -> BackendResult<bool> {
        use std::path::Path;

        let home = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));

        if home.is_empty() {
            return Ok(false);
        }

        let path_obj = Path::new(&path);
        let home_obj = Path::new(&home);

        // Canonicalize both paths to handle symbolic links and relative paths
        match (path_obj.canonicalize(), home_obj.canonicalize()) {
            (Ok(canonical_path), Ok(canonical_home)) => Ok(canonical_path == canonical_home),
            _ => {
                // Fallback to string comparison if canonicalization fails
                Ok(path_obj == home_obj)
            }
        }
    }

    /// List projects (filesystem-backed) for the Projects page
    pub async fn list_projects(&self, limit: u32, offset: u32) -> BackendResult<ProjectsResponse> {
        // Cap limit to max 100 and at least 1
        let lim = std::cmp::min(limit.max(1), 100);
        list_projects(lim, offset)
    }

    /// Get discussions (conversations) for a specific project
    pub async fn get_project_discussions(&self, project_id: &str) -> BackendResult<Vec<RecentChat>> {
        use std::ffi::OsStr;
        use std::time::{SystemTime, UNIX_EPOCH};

        // Resolve projects root
        let home = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));
        if home.is_empty() {
            return Err(BackendError::SessionInitFailed(
                "Could not determine home directory".to_string(),
            ));
        }
        let project_path = std::path::Path::new(&home)
            .join(".gemini-desktop")
            .join("projects")
            .join(project_id);
        
        if !project_path.exists() || !project_path.is_dir() {
            return Ok(vec![]);
        }

        let mut discussions: Vec<RecentChat> = Vec::new();

        // Enumerate rpc-log-*.log files in this project folder
        let logs_iter = match std::fs::read_dir(&project_path) {
            Ok(l) => l,
            Err(_) => return Ok(vec![]),
        };

        for log_entry in logs_iter {
            let log_entry = match log_entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let log_path = log_entry.path();
            let Some(name) = log_path.file_name().and_then(OsStr::to_str) else {
                continue;
            };

            // Select only files named rpc-log-*.log
            if !(name.starts_with("rpc-log-") && name.ends_with(".log")) {
                continue;
            }

            // Extract timestamp from filename for started_at_iso
            let timestamp_str = name
                .strip_prefix("rpc-log-")
                .and_then(|s| s.strip_suffix(".log"))
                .unwrap_or("0");
            
            let timestamp_millis = timestamp_str.parse::<u64>().unwrap_or(0);
            let started_secs = timestamp_millis / 1000;
            let started_iso = chrono::DateTime::<chrono::Utc>::from(
                UNIX_EPOCH + std::time::Duration::from_secs(started_secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

            // Extract message_count and first user text from this specific log file
            let (message_count, first_user_text) = Self::extract_chat_data(Some(log_path.clone()));

            // Generate title from first user message or use default
            let title = if let Some(t) = first_user_text.clone() {
                let t = t.trim();
                if t.is_empty() {
                    format!("Conversation {}", &name[8..14]) // Use part of timestamp
                } else if t.len() > 50 {
                    format!("{}…", &t[..50])
                } else {
                    t.to_string()
                }
            } else {
                format!("Conversation {}", &name[8..14]) // Use part of timestamp
            };

            // Per-log unique id: "{project_id}:{file_name}"
            let id = format!("{}:{}", project_id, name);

            discussions.push(RecentChat {
                id,
                title,
                started_at_iso: started_iso,
                message_count,
            });
        }

        // Sort by timestamp descending (newest first)
        discussions.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));

        Ok(discussions)
    }

    /// Get the user's home directory path
    pub async fn get_home_directory(&self) -> BackendResult<String> {
        let home = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));

        if home.is_empty() {
            return Err(BackendError::SessionInitFailed(
                "Could not determine home directory".to_string(),
            ));
        }

        Ok(home)
    }

    /// Get the parent directory of the given path
    pub async fn get_parent_directory(&self, path: String) -> BackendResult<Option<String>> {
        let path_obj = Path::new(&path);
        match path_obj.parent() {
            Some(parent) => Ok(Some(parent.to_string_lossy().to_string())),
            None => {
                // Handle filesystem roots differently per OS
                #[cfg(target_os = "windows")]
                {
                    // On Windows, if we're at a drive root (C:\), return None to show volumes
                    Ok(None)
                }
                #[cfg(not(target_os = "windows"))]
                {
                    // On Unix, if we're at root (/), stay at root instead of showing volumes
                    if path == "/" {
                        Ok(Some("/".to_string()))
                    } else {
                        Ok(None)
                    }
                }
            }
        }
    }

    /// List available volumes/drives on the system
    pub async fn list_volumes(&self) -> BackendResult<Vec<DirEntry>> {
        let mut volumes = Vec::new();

        #[cfg(target_os = "windows")]
        {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;

            // Use Windows API to get logical drives
            let drives_bitmask =
                unsafe { windows_sys::Win32::Storage::FileSystem::GetLogicalDrives() };

            if drives_bitmask == 0 {
                return Err(BackendError::SessionInitFailed(
                    "Failed to enumerate drives".to_string(),
                ));
            }

            // Check each bit to see which drives exist
            for i in 0..26 {
                if (drives_bitmask & (1 << i)) != 0 {
                    let drive_letter = (b'A' + i) as char;
                    let drive_path = format!("{}:\\", drive_letter);

                    // Get drive type to provide better information
                    let drive_type = unsafe {
                        let path_wide: Vec<u16> = OsStr::new(&drive_path)
                            .encode_wide()
                            .chain(std::iter::once(0))
                            .collect();
                        windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(path_wide.as_ptr())
                    };

                    let (name, volume_type) = match drive_type {
                        3 => (
                            format!("Local Disk ({}:)", drive_letter),
                            VolumeType::LocalDisk,
                        ), // DRIVE_FIXED
                        2 => (
                            format!("Removable Disk ({}:)", drive_letter),
                            VolumeType::RemovableDisk,
                        ), // DRIVE_REMOVABLE
                        4 => (
                            format!("Network Drive ({}:)", drive_letter),
                            VolumeType::NetworkDrive,
                        ), // DRIVE_REMOTE
                        5 => (format!("CD Drive ({}:)", drive_letter), VolumeType::CdDrive), // DRIVE_CDROM
                        6 => (format!("RAM Disk ({}:)", drive_letter), VolumeType::RamDisk), // DRIVE_RAMDISK
                        _ => (format!("{}:", drive_letter), VolumeType::LocalDisk),
                    };

                    volumes.push(DirEntry {
                        name,
                        is_directory: true,
                        full_path: drive_path,
                        size: None,
                        modified: None,
                        is_symlink: false,
                        symlink_target: None,
                        volume_type: Some(volume_type),
                    });
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On Unix systems, we typically don't show a "volume" view like Windows
            // If this function is called, just return the root filesystem
            let root_path = Path::new("/");
            if root_path.exists() && root_path.is_dir() {
                volumes.push(DirEntry {
                    name: "File System".to_string(),
                    is_directory: true,
                    full_path: "/".to_string(),
                    size: None,
                    modified: None,
                    is_symlink: false,
                    symlink_target: None,
                    volume_type: Some(VolumeType::FileSystem),
                });
            }
        }

        Ok(volumes)
    }

    /// List the contents of a directory
    pub async fn list_directory_contents(&self, path: String) -> BackendResult<Vec<DirEntry>> {
        let path_obj = Path::new(&path);

        if !path_obj.exists() {
            return Err(BackendError::SessionInitFailed(format!(
                "Directory does not exist: {}",
                path
            )));
        }

        if !path_obj.is_dir() {
            return Err(BackendError::SessionInitFailed(format!(
                "Path is not a directory: {}",
                path
            )));
        }

        let mut entries = Vec::new();
        let read_dir = std::fs::read_dir(path_obj).map_err(|e| BackendError::IoError(e))?;

        for entry in read_dir {
            let entry = entry.map_err(|e| BackendError::IoError(e))?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            let full_path = entry.path().to_string_lossy().to_string();

            // Always use symlink_metadata to avoid following symlinks
            let symlink_metadata = entry
                .path()
                .symlink_metadata()
                .map_err(|e| BackendError::IoError(e))?;
            let is_symlink = symlink_metadata.file_type().is_symlink();

            // Get symlink target if this is a symlink
            let symlink_target = if is_symlink {
                entry
                    .path()
                    .read_link()
                    .ok()
                    .map(|target| target.to_string_lossy().to_string())
            } else {
                None
            };

            // For symlinks, try to get metadata of the target, but fallback to symlink metadata if target is inaccessible
            let (is_directory, size, modified) = if is_symlink {
                // Try to get target metadata, but don't fail if target is inaccessible
                match entry.metadata() {
                    Ok(target_metadata) => {
                        let size = if target_metadata.is_file() {
                            Some(target_metadata.len())
                        } else {
                            None
                        };
                        let modified = target_metadata
                            .modified()
                            .ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|duration| duration.as_secs());
                        (target_metadata.is_dir(), size, modified)
                    }
                    Err(_) => {
                        // Target is inaccessible, use symlink's own metadata
                        let modified = symlink_metadata
                            .modified()
                            .ok()
                            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|duration| duration.as_secs());
                        (false, None, modified)
                    }
                }
            } else {
                // Not a symlink, use symlink_metadata (which is the same as metadata for non-symlinks)
                let size = if symlink_metadata.is_file() {
                    Some(symlink_metadata.len())
                } else {
                    None
                };
                let modified = symlink_metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs());
                (symlink_metadata.is_dir(), size, modified)
            };

            entries.push(DirEntry {
                name: file_name,
                is_directory,
                full_path,
                size,
                modified,
                is_symlink,
                symlink_target,
                volume_type: None, // Regular directory entries don't have volume types
            });
        }

        // Sort entries: directories first, then files, both alphabetically
        entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(entries)
    }
}
