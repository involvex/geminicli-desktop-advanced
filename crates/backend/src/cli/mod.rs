use crate::events::ToolCallLocation;
use crate::rpc::deserialize_string_or_number;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SendUserMessageParams {
    pub chunks: Vec<MessageChunk>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageChunk {
    Text { text: String },
    Path { path: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StreamAssistantMessageChunkParams {
    pub chunk: AssistantChunk,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssistantChunk {
    pub thought: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallParams {
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallResult {
    pub id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateToolCallParams {
    #[serde(rename = "toolCallId")]
    #[serde(deserialize_with = "deserialize_string_or_number")]
    pub tool_call_id: u32,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationParams {
    pub label: String,
    pub icon: String,
    pub content: Option<crate::events::ToolCallConfirmationContent>,
    pub confirmation: crate::events::ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationResult {
    pub id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}
