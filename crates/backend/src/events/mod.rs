use crate::types::BackendResult;
use serde::{Deserialize, Serialize};

pub trait EventEmitter: Send + Sync + Clone {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> BackendResult<()>;
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliIoPayload {
    #[serde(rename = "type")]
    pub io_type: CliIoType,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CliIoType {
    Input,
    Output,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiOutputPayload {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiThoughtPayload {
    pub thought: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEvent {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallUpdate {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallLocation {
    pub path: String,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmation {
    #[serde(rename = "type")]
    pub confirmation_type: String,
    #[serde(rename = "rootCommand", default)]
    pub root_command: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
}
