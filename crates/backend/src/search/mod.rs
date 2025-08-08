use crate::types::BackendResult;
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentChat {
    pub id: String,
    pub title: String,
    pub started_at_iso: String,
    pub message_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub chat: RecentChat,
    pub matches: Vec<MessageMatch>,
    pub relevance_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMatch {
    pub content_snippet: String,
    pub line_number: u32,
    pub context_before: Option<String>,
    pub context_after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub date_range: Option<(String, String)>,
    pub project_hash: Option<String>,
    pub max_results: Option<u32>,
}

fn parse_timestamp_from_filename(filename: &str) -> Option<u64> {
    filename
        .strip_prefix("rpc-log-")
        .and_then(|s| s.strip_suffix(".log"))
        .and_then(|s| s.parse::<u64>().ok())
}

fn generate_title_from_messages(log_path: &Path) -> String {
    if let Ok(file) = File::open(log_path) {
        let reader = BufReader::new(file);
        let mut first_user_message = String::new();

        for line in reader.lines().map_while(Result::ok) {
            if line.contains(r#""method":"sendUserMessage""#)
                && let Some(start) = line.find(r#""text":""#)
            {
                let start = start + 8;
                if let Some(end) = line[start..].find('"') {
                    first_user_message = line[start..start + end].to_string();
                    break;
                }
            }
        }

        if !first_user_message.is_empty() {
            if first_user_message.len() > 50 {
                format!("{}...", &first_user_message[..50])
            } else {
                first_user_message
            }
        } else {
            "Chat Session".to_string()
        }
    } else {
        "Chat Session".to_string()
    }
}

fn count_messages_in_log(log_path: &Path) -> u32 {
    let mut count = 0;
    if let Ok(file) = File::open(log_path) {
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            if line.contains(r#""method":"sendUserMessage""#)
                || line.contains(r#""method":"streamAssistantMessageChunk""#)
            {
                count += 1;
            }
        }
    }
    count
}

pub async fn get_recent_chats() -> BackendResult<Vec<RecentChat>> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let projects_dir = Path::new(&home).join(".gemini-desktop").join("projects");

    let mut all_chats = Vec::new();

    if projects_dir.exists()
        && let Ok(projects) = std::fs::read_dir(&projects_dir)
    {
        for project in projects.flatten() {
            if project.path().is_dir() {
                let project_hash = project.file_name().to_string_lossy().to_string();

                if let Ok(logs) = std::fs::read_dir(project.path()) {
                    for log_entry in logs.flatten() {
                        let filename = log_entry.file_name().to_string_lossy().to_string();
                        if filename.starts_with("rpc-log-")
                            && filename.ends_with(".log")
                            && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
                        {
                            let log_path = log_entry.path();
                            let title = generate_title_from_messages(&log_path);
                            let message_count = count_messages_in_log(&log_path);

                            let datetime = DateTime::<Local>::from(
                                std::time::UNIX_EPOCH
                                    + std::time::Duration::from_millis(timestamp_ms),
                            );

                            all_chats.push(RecentChat {
                                id: format!("{project_hash}/{filename}"),
                                title,
                                started_at_iso: datetime.to_rfc3339(),
                                message_count,
                            });
                        }
                    }
                }
            }
        }
    }

    all_chats.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));
    all_chats.truncate(20);

    Ok(all_chats)
}

pub async fn search_chats(
    query: String,
    filters: Option<SearchFilters>,
) -> BackendResult<Vec<SearchResult>> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let projects_dir = Path::new(&home).join(".gemini-desktop").join("projects");
    let mut results = Vec::new();

    let query_lower = query.to_lowercase();
    let max_results = filters.as_ref().and_then(|f| f.max_results).unwrap_or(50);

    if projects_dir.exists()
        && let Ok(projects) = std::fs::read_dir(&projects_dir)
    {
        for project in projects.flatten() {
            if project.path().is_dir() {
                let project_hash = project.file_name().to_string_lossy().to_string();

                if let Some(ref f) = filters
                    && let Some(ref filter_hash) = f.project_hash
                    && &project_hash != filter_hash
                {
                    continue;
                }

                if let Ok(logs) = std::fs::read_dir(project.path()) {
                    for log_entry in logs.flatten() {
                        let filename = log_entry.file_name().to_string_lossy().to_string();
                        if filename.starts_with("rpc-log-")
                            && filename.ends_with(".log")
                            && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
                        {
                            let log_path = log_entry.path();
                            let mut matches = Vec::new();

                            if let Ok(file) = File::open(&log_path) {
                                let reader = BufReader::new(file);
                                let lines: Vec<String> =
                                    reader.lines().map_while(Result::ok).collect();

                                for (i, line) in lines.iter().enumerate() {
                                    let line_lower = line.to_lowercase();
                                    if line_lower.contains(&query_lower) {
                                        let snippet = if line.len() > 200 {
                                            format!("{}...", &line[..200])
                                        } else {
                                            line.clone()
                                        };

                                        let context_before = if i > 0 {
                                            Some(lines[i - 1].clone())
                                        } else {
                                            None
                                        };
                                        let context_after = if i < lines.len() - 1 {
                                            Some(lines[i + 1].clone())
                                        } else {
                                            None
                                        };

                                        matches.push(MessageMatch {
                                            content_snippet: snippet,
                                            line_number: (i + 1) as u32,
                                            context_before,
                                            context_after,
                                        });
                                    }
                                }
                            }

                            if !matches.is_empty() {
                                let title = generate_title_from_messages(&log_path);
                                let message_count = count_messages_in_log(&log_path);

                                let datetime = DateTime::<Local>::from(
                                    std::time::UNIX_EPOCH
                                        + std::time::Duration::from_millis(timestamp_ms),
                                );

                                let relevance_score = matches.len() as f32;

                                results.push(SearchResult {
                                    chat: RecentChat {
                                        id: format!("{project_hash}/{filename}"),
                                        title,
                                        started_at_iso: datetime.to_rfc3339(),
                                        message_count,
                                    },
                                    matches,
                                    relevance_score,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
    results.truncate(max_results as usize);

    Ok(results)
}

pub async fn get_project_discussions(project_id: &str) -> BackendResult<Vec<RecentChat>> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let project_dir = Path::new(&home)
        .join(".gemini-desktop")
        .join("projects")
        .join(project_id);

    let mut chats = Vec::new();

    if project_dir.exists()
        && let Ok(logs) = std::fs::read_dir(&project_dir)
    {
        for log_entry in logs.flatten() {
            let filename = log_entry.file_name().to_string_lossy().to_string();
            if filename.starts_with("rpc-log-")
                && filename.ends_with(".log")
                && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
            {
                let log_path = log_entry.path();
                let title = generate_title_from_messages(&log_path);
                let message_count = count_messages_in_log(&log_path);

                let datetime = DateTime::<Local>::from(
                    std::time::UNIX_EPOCH + std::time::Duration::from_millis(timestamp_ms),
                );

                chats.push(RecentChat {
                    id: format!("{project_id}/{filename}"),
                    title,
                    started_at_iso: datetime.to_rfc3339(),
                    message_count,
                });
            }
        }
    }

    chats.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));
    Ok(chats)
}
