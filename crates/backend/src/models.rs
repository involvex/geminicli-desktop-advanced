use crate::types::BackendResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub provider: String,
    pub description: String,
    pub context_length: Option<u32>,
    pub capabilities: Vec<String>,
    pub is_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSource {
    pub name: String,
    pub url: String,
    pub api_key_required: bool,
}

/// Get available models from Gemini CLI
pub async fn get_gemini_models() -> BackendResult<Vec<ModelInfo>> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "gemini", "models", "list", "--json"])
            .output()
            .await
    } else {
        Command::new("gemini")
            .args(["models", "list", "--json"])
            .output()
            .await
    };

    match output {
        Ok(result) if result.status.success() => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            parse_gemini_models(&stdout)
        }
        Ok(result) => {
            // Fallback to default models if command fails
            eprintln!("Gemini CLI models command failed: {}", String::from_utf8_lossy(&result.stderr));
            Ok(get_default_gemini_models())
        }
        Err(_) => {
            // Fallback to default models if CLI not available
            Ok(get_default_gemini_models())
        }
    }
}

fn parse_gemini_models(json_output: &str) -> BackendResult<Vec<ModelInfo>> {
    // Try to parse JSON output from Gemini CLI
    if let Ok(models) = serde_json::from_str::<Vec<serde_json::Value>>(json_output) {
        let mut model_infos = Vec::new();
        for model in models {
            if let Some(name) = model.get("name").and_then(|n| n.as_str()) {
                model_infos.push(ModelInfo {
                    name: name.to_string(),
                    provider: "Google".to_string(),
                    description: model.get("description")
                        .and_then(|d| d.as_str())
                        .unwrap_or("Gemini model")
                        .to_string(),
                    context_length: model.get("inputTokenLimit")
                        .and_then(|c| c.as_u64())
                        .map(|c| c as u32),
                    capabilities: vec!["text".to_string(), "vision".to_string()],
                    is_available: true,
                });
            }
        }
        Ok(model_infos)
    } else {
        Ok(get_default_gemini_models())
    }
}

fn get_default_gemini_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            name: "gemini-2.5-pro".to_string(),
            provider: "Google".to_string(),
            description: "Most capable Gemini model for complex tasks".to_string(),
            context_length: Some(2_000_000),
            capabilities: vec!["text".to_string(), "vision".to_string(), "code".to_string()],
            is_available: true,
        },
        ModelInfo {
            name: "gemini-2.5-flash".to_string(),
            provider: "Google".to_string(),
            description: "Fast and efficient Gemini model".to_string(),
            context_length: Some(1_000_000),
            capabilities: vec!["text".to_string(), "vision".to_string(), "code".to_string()],
            is_available: true,
        },
        ModelInfo {
            name: "gemini-2.5-flash-lite".to_string(),
            provider: "Google".to_string(),
            description: "Lightweight Gemini model for quick tasks".to_string(),
            context_length: Some(100_000),
            capabilities: vec!["text".to_string()],
            is_available: true,
        },
    ]
}

/// Get available model sources/providers
pub async fn get_model_sources() -> BackendResult<Vec<ModelSource>> {
    Ok(vec![
        ModelSource {
            name: "Google Gemini".to_string(),
            url: "https://ai.google.dev/".to_string(),
            api_key_required: true,
        },
        ModelSource {
            name: "OpenAI".to_string(),
            url: "https://openai.com/".to_string(),
            api_key_required: true,
        },
        ModelSource {
            name: "Anthropic".to_string(),
            url: "https://anthropic.com/".to_string(),
            api_key_required: true,
        },
        ModelSource {
            name: "Ollama".to_string(),
            url: "https://ollama.ai/".to_string(),
            api_key_required: false,
        },
    ])
}

/// Auto-discover available models from multiple sources
pub async fn auto_discover_models() -> BackendResult<HashMap<String, Vec<ModelInfo>>> {
    let mut all_models = HashMap::new();
    
    // Get Gemini models
    if let Ok(gemini_models) = get_gemini_models().await {
        all_models.insert("gemini".to_string(), gemini_models);
    }
    
    // Try to get Ollama models if available
    if let Ok(ollama_models) = get_ollama_models().await {
        all_models.insert("ollama".to_string(), ollama_models);
    }
    
    Ok(all_models)
}

async fn get_ollama_models() -> BackendResult<Vec<ModelInfo>> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "ollama", "list"])
            .output()
            .await
    } else {
        Command::new("ollama")
            .args(["list"])
            .output()
            .await
    };

    match output {
        Ok(result) if result.status.success() => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            parse_ollama_models(&stdout)
        }
        _ => Ok(vec![]), // Return empty if Ollama not available
    }
}

fn parse_ollama_models(output: &str) -> BackendResult<Vec<ModelInfo>> {
    let mut models = Vec::new();
    
    for line in output.lines().skip(1) { // Skip header
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(name) = parts.first() {
            models.push(ModelInfo {
                name: name.to_string(),
                provider: "Ollama".to_string(),
                description: format!("Local Ollama model: {}", name),
                context_length: None,
                capabilities: vec!["text".to_string()],
                is_available: true,
            });
        }
    }
    
    Ok(models)
}