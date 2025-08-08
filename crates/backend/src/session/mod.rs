use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;

use crate::cli::{
    PushToolCallParams, RequestToolCallConfirmationParams, StreamAssistantMessageChunkParams,
    UpdateToolCallParams,
};
use crate::events::{
    CliIoPayload, CliIoType, ErrorPayload, EventEmitter, GeminiOutputPayload, GeminiThoughtPayload,
    InternalEvent, ToolCallConfirmationRequest, ToolCallEvent, ToolCallUpdate,
};
use crate::rpc::{FileRpcLogger, JsonRpcRequest, JsonRpcResponse, NoOpRpcLogger, RpcLogger};
use crate::types::{BackendError, BackendResult};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessStatus {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
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

pub type ProcessMap = Arc<Mutex<HashMap<String, PersistentSession>>>;

pub struct SessionManager {
    processes: ProcessMap,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        let processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        let statuses = processes.values().map(ProcessStatus::from).collect();

        Ok(statuses)
    }

    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        if let Some(session) = processes.get_mut(conversation_id) {
            if let Some(mut child) = session.child.take() {
                drop(child.kill());
            } else if let Some(pid) = session.pid {
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

            session.is_alive = false;
            session.pid = None;
            session.stdin = None;
            session.message_sender = None;
        }

        Ok(())
    }

    pub(crate) fn get_processes(&self) -> &ProcessMap {
        &self.processes
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn initialize_session<E: EventEmitter + 'static>(
    session_id: String,
    working_directory: String,
    model: String,
    emitter: E,
    session_manager: &SessionManager,
) -> BackendResult<(mpsc::UnboundedSender<String>, Arc<dyn RpcLogger>)> {
    println!("🚀 Initializing persistent Gemini session for: {session_id}");

    let rpc_logger: Arc<dyn RpcLogger> = match FileRpcLogger::new(Some(&working_directory)) {
        Ok(logger) => {
            println!("📝 RPC logging enabled for session: {session_id}");
            let _ = logger.cleanup_old_logs();
            Arc::new(logger)
        }
        Err(e) => {
            println!("⚠️  Failed to create RPC logger for session {session_id}: {e}");
            Arc::new(NoOpRpcLogger)
        }
    };

    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();

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

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if !working_directory.is_empty() {
        println!("🗂️ Setting working directory to: {working_directory}");
        cmd.current_dir(&working_directory);
    }

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

    let _ = rpc_logger.log_rpc(&request_json);

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

    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Input,
            data: request_json.clone(),
        },
    );

    let mut reader = AsyncBufReader::new(stdout);
    let mut line = String::new();
    reader.read_line(&mut line).await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to read init response: {e}"))
    })?;

    let _ = rpc_logger.log_rpc(line.trim());

    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Output,
            data: line.trim().to_string(),
        },
    );

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

    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<InternalEvent>();

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

async fn handle_session_io_internal(
    session_id: String,
    mut reader: AsyncBufReader<ChildStdout>,
    mut message_rx: mpsc::UnboundedReceiver<String>,
    processes: ProcessMap,
    event_tx: mpsc::UnboundedSender<InternalEvent>,
) {
    let mut tool_call_id = 1001u32;
    let mut pending_send_message_requests = HashSet::<u32>::new();
    let mut line_buffer = String::new();

    loop {
        tokio::select! {
            message = message_rx.recv() => {
                if let Some(message_json) = message {
                    let stdin_opt = {
                        let mut processes_guard = processes.lock().unwrap();
                        if let Some(session) = processes_guard.get_mut(&session_id) {
                            session.stdin.take()
                        } else {
                            None
                        }
                    };

                    if let Some(mut stdin) = stdin_opt {
                        if let Ok(json_request) = serde_json::from_str::<JsonRpcRequest>(&message_json)
                            && json_request.method == "sendUserMessage"
                        {
                            pending_send_message_requests.insert(json_request.id);
                        }

                        if let Ok(processes_guard) = processes.lock()
                            && let Some(session) = processes_guard.get(&session_id)
                        {
                            let _ = session.rpc_logger.log_rpc(&message_json);
                        }

                        if let Err(e) = stdin.write_all(message_json.as_bytes()).await {
                            eprintln!("Failed to write to stdin: {e}");
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            eprintln!("Failed to write newline: {e}");
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            eprintln!("Failed to flush stdin: {e}");
                            break;
                        }

                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Input,
                                data: message_json,
                            },
                        });

                        {
                            let mut processes_guard = processes.lock().unwrap();
                            if let Some(session) = processes_guard.get_mut(&session_id) {
                                session.stdin = Some(stdin);
                            }
                        }
                    }
                } else {
                    println!("Message receiver closed for session: {session_id}");
                    break;
                }
            }

            result = reader.read_line(&mut line_buffer) => {
                match result {
                    Ok(0) => {
                        println!("CLI process closed for session: {session_id}");
                        break;
                    }
                    Ok(_) => {
                        let line = line_buffer.trim().to_string();

                        if let Ok(processes_guard) = processes.lock()
                            && let Some(session) = processes_guard.get(&session_id)
                        {
                            let _ = session.rpc_logger.log_rpc(&line);
                        }

                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Output,
                                data: line.clone(),
                            },
                        });

                        handle_cli_output_line(
                            &session_id,
                            &line,
                            &event_tx,
                            &mut tool_call_id,
                            &mut pending_send_message_requests,
                        ).await;

                        line_buffer.clear();
                    }
                    Err(e) => {
                        eprintln!("Error reading from CLI: {e}");
                        break;
                    }
                }
            }
        }
    }

    {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(&session_id) {
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        }
    }

    println!("🛑 Session I/O handler finished for: {session_id}");
}

pub async fn send_response_to_cli(
    session_id: &str,
    request_id: u32,
    result: Option<serde_json::Value>,
    error: Option<crate::rpc::JsonRpcError>,
    processes: &ProcessMap,
) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: request_id,
        result,
        error,
    };

    let response_json = serde_json::to_string(&response).unwrap();

    if let Ok(processes_guard) = processes.lock()
        && let Some(session) = processes_guard.get(session_id)
    {
        let _ = session.rpc_logger.log_rpc(&response_json);
    }

    if let Some(sender) = {
        let mut processes_guard = processes.lock().unwrap();
        processes_guard
            .get_mut(session_id)
            .and_then(|s| s.message_sender.clone())
    } {
        let _ = sender.send(response_json);
    }
}

async fn handle_cli_output_line(
    session_id: &str,
    line: &str,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
    tool_call_id: &mut u32,
    pending_send_message_requests: &mut HashSet<u32>,
) {
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
        if let Some(method) = json_value.get("method").and_then(|m| m.as_str()) {
            match method {
                "streamAssistantMessageChunk" => {
                    if let Ok(params) = serde_json::from_value::<StreamAssistantMessageChunkParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) {
                        if let Some(thought) = params.chunk.thought {
                            let _ = event_tx.send(InternalEvent::GeminiThought {
                                session_id: session_id.to_string(),
                                payload: GeminiThoughtPayload { thought },
                            });
                        }
                        if let Some(text) = params.chunk.text {
                            let _ = event_tx.send(InternalEvent::GeminiOutput {
                                session_id: session_id.to_string(),
                                payload: GeminiOutputPayload { text },
                            });
                        }
                    }
                }
                "pushToolCall" => {
                    if let Ok(params) = serde_json::from_value::<PushToolCallParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) {
                        let event = ToolCallEvent {
                            id: *tool_call_id,
                            name: params.label.clone(),
                            icon: params.icon,
                            label: params.label,
                            locations: params.locations,
                            status: "pending".to_string(),
                        };

                        let _ = event_tx.send(InternalEvent::ToolCall {
                            session_id: session_id.to_string(),
                            payload: event,
                        });

                        *tool_call_id += 1;
                    }
                }
                "updateToolCall" => {
                    if let Ok(params) = serde_json::from_value::<UpdateToolCallParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) {
                        let _ = event_tx.send(InternalEvent::ToolCallUpdate {
                            session_id: session_id.to_string(),
                            payload: ToolCallUpdate {
                                tool_call_id: params.tool_call_id,
                                status: params.status,
                                content: params.content,
                            },
                        });
                    }
                }
                "requestToolCallConfirmation" => {
                    if let Ok(params) = serde_json::from_value::<RequestToolCallConfirmationParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) && let Some(id) = json_value.get("id").and_then(|i| i.as_u64())
                    {
                        let request = ToolCallConfirmationRequest {
                            request_id: id as u32,
                            session_id: session_id.to_string(),
                            label: params.label,
                            icon: params.icon,
                            content: params.content,
                            confirmation: params.confirmation,
                            locations: params.locations,
                        };

                        let _ = event_tx.send(InternalEvent::ToolCallConfirmation {
                            session_id: session_id.to_string(),
                            payload: request,
                        });
                    }
                }
                _ => {}
            }
        }

        if let Some(id) = json_value.get("id").and_then(|i| i.as_u64()) {
            let id_u32 = id as u32;

            if pending_send_message_requests.contains(&id_u32) {
                if json_value.get("result").is_some() {
                    pending_send_message_requests.remove(&id_u32);
                    let _ = event_tx.send(InternalEvent::GeminiTurnFinished {
                        session_id: session_id.to_string(),
                    });
                } else if let Some(error) = json_value.get("error") {
                    pending_send_message_requests.remove(&id_u32);
                    let error_msg = error.to_string();
                    let _ = event_tx.send(InternalEvent::Error {
                        session_id: session_id.to_string(),
                        payload: ErrorPayload { error: error_msg },
                    });
                }
            }
        }
    }
}
