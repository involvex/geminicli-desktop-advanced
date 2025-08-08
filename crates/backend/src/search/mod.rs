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
            let mut title = first_user_message;
            if title.len() > 50 {
                title.truncate(50);
                title.push_str("...");
            }
            title
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    use serial_test::serial;

    #[test]
    #[serial]
    fn test_recent_chat_serialization() {
        let chat = RecentChat {
            id: "test/log.log".to_string(),
            title: "Test Chat".to_string(),
            started_at_iso: "2023-01-01T00:00:00Z".to_string(),
            message_count: 5,
        };

        let json = serde_json::to_string(&chat).unwrap();
        let deserialized: RecentChat = serde_json::from_str(&json).unwrap();
        
        assert_eq!(chat.id, deserialized.id);
        assert_eq!(chat.title, deserialized.title);
        assert_eq!(chat.started_at_iso, deserialized.started_at_iso);
        assert_eq!(chat.message_count, deserialized.message_count);
    }

    #[test]
    #[serial]
    fn test_message_match_serialization() {
        let match_item = MessageMatch {
            content_snippet: "test content".to_string(),
            line_number: 42,
            context_before: Some("before context".to_string()),
            context_after: Some("after context".to_string()),
        };

        let json = serde_json::to_string(&match_item).unwrap();
        let deserialized: MessageMatch = serde_json::from_str(&json).unwrap();
        
        assert_eq!(match_item.content_snippet, deserialized.content_snippet);
        assert_eq!(match_item.line_number, deserialized.line_number);
        assert_eq!(match_item.context_before, deserialized.context_before);
        assert_eq!(match_item.context_after, deserialized.context_after);
    }

    #[test]
    #[serial]
    fn test_search_result_serialization() {
        let result = SearchResult {
            chat: RecentChat {
                id: "test/log.log".to_string(),
                title: "Test Chat".to_string(),
                started_at_iso: "2023-01-01T00:00:00Z".to_string(),
                message_count: 5,
            },
            matches: vec![MessageMatch {
                content_snippet: "test content".to_string(),
                line_number: 42,
                context_before: None,
                context_after: None,
            }],
            relevance_score: 1.5,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: SearchResult = serde_json::from_str(&json).unwrap();
        
        assert_eq!(result.chat.id, deserialized.chat.id);
        assert_eq!(result.matches.len(), deserialized.matches.len());
        assert_eq!(result.relevance_score, deserialized.relevance_score);
    }

    #[test]
    #[serial]
    fn test_search_filters_default() {
        let filters = SearchFilters::default();
        assert!(filters.date_range.is_none());
        assert!(filters.project_hash.is_none());
        assert!(filters.max_results.is_none());
    }

    #[test]
    #[serial]
    fn test_search_filters_serialization() {
        let filters = SearchFilters {
            date_range: Some(("2023-01-01".to_string(), "2023-01-31".to_string())),
            project_hash: Some("abc123".to_string()),
            max_results: Some(25),
        };

        let json = serde_json::to_string(&filters).unwrap();
        let deserialized: SearchFilters = serde_json::from_str(&json).unwrap();
        
        assert_eq!(filters.date_range, deserialized.date_range);
        assert_eq!(filters.project_hash, deserialized.project_hash);
        assert_eq!(filters.max_results, deserialized.max_results);
    }

    #[test]
    #[serial]
    fn test_parse_timestamp_from_filename_valid() {
        assert_eq!(parse_timestamp_from_filename("rpc-log-1640995200000.log"), Some(1640995200000));
        assert_eq!(parse_timestamp_from_filename("rpc-log-123456789.log"), Some(123456789));
    }

    #[test]
    #[serial]
    fn test_parse_timestamp_from_filename_invalid() {
        assert_eq!(parse_timestamp_from_filename("invalid.log"), None);
        assert_eq!(parse_timestamp_from_filename("rpc-log-invalid.log"), None);
        assert_eq!(parse_timestamp_from_filename("rpc-log-123.txt"), None);
        assert_eq!(parse_timestamp_from_filename("log-123.log"), None);
    }

    #[test]
    #[serial]
    fn test_generate_title_from_messages_with_user_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");
        
        let content = r#"{"method":"sendUserMessage","params":{"text":"Hello, how can I help you today?"}}"#;
        fs::write(&log_path, content).unwrap();
        
        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Hello, how can I help you today?");
    }

    #[test]
    #[serial]
    fn test_generate_title_from_messages_long_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");
        
        let long_text = "a".repeat(100);
        let content = format!(r#"{{"method":"sendUserMessage","params":{{"text":"{}"}}}}"#, long_text);
        fs::write(&log_path, content).unwrap();
        
        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, format!("{}...", "a".repeat(50)));
    }

    #[test]
    #[serial]
    fn test_generate_title_from_messages_no_user_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");
        
        let content = r#"{"method":"otherMethod","params":{"data":"some data"}}"#;
        fs::write(&log_path, content).unwrap();
        
        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Chat Session");
    }

    #[test]
    #[serial]
    fn test_generate_title_from_messages_file_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("nonexistent.log");
        
        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Chat Session");
    }

    #[test]
    #[serial]
    fn test_count_messages_in_log_with_messages() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");
        
        let content = r#"{"method":"sendUserMessage","params":{"text":"Hello"}}
{"method":"streamAssistantMessageChunk","params":{"chunk":"Hi there"}}
{"method":"sendUserMessage","params":{"text":"How are you?"}}
{"method":"otherMethod","params":{"data":"ignored"}}"#;
        fs::write(&log_path, content).unwrap();
        
        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 3); // 2 user messages + 1 assistant chunk
    }

    #[test]
    #[serial]
    fn test_count_messages_in_log_no_messages() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");
        
        let content = r#"{"method":"otherMethod","params":{"data":"some data"}}
{"method":"anotherMethod","params":{"info":"more info"}}"#;
        fs::write(&log_path, content).unwrap();
        
        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 0);
    }

    #[test]
    #[serial]
    fn test_count_messages_in_log_file_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("nonexistent.log");
        
        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_chats_no_home() {
        unsafe {
            std::env::remove_var("HOME");
            std::env::remove_var("USERPROFILE");
            std::env::set_var("HOME", ".");
        }
        
        // Should not fail, but may return empty results if no projects directory exists
        let result = get_recent_chats().await;
        assert!(result.is_ok());
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_chats_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        // Create projects directory but leave it empty
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();
        
        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 0);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_chats_with_logs() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project_hash");
        fs::create_dir_all(&project_dir).unwrap();
        
        // Create a log file with valid name and content
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        let content = r#"{"method":"sendUserMessage","params":{"text":"Test message"}}"#;
        fs::write(&log_file, content).unwrap();
        
        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].title, "Test message");
        assert_eq!(result[0].message_count, 1);
        assert!(result[0].id.contains("test_project_hash"));
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_chats_sorts_by_date() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        // Create multiple log files with different timestamps
        let older_log = project_dir.join("rpc-log-1640995100000.log");
        let newer_log = project_dir.join("rpc-log-1640995200000.log");
        
        let content = r#"{"method":"sendUserMessage","params":{"text":"Test"}}"#;
        fs::write(&older_log, content).unwrap();
        fs::write(&newer_log, content).unwrap();
        
        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 2);
        // Newer chat should be first
        assert!(result[0].id.contains("1640995200000"));
        assert!(result[1].id.contains("1640995100000"));
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_recent_chats_limits_to_20() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        let content = r#"{"method":"sendUserMessage","params":{"text":"Test"}}"#;
        
        // Create 25 log files
        for i in 0..25 {
            let timestamp = 1640995200000u64 + i as u64;
            let log_file = project_dir.join(format!("rpc-log-{}.log", timestamp));
            fs::write(&log_file, content).unwrap();
        }
        
        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 20); // Should be limited to 20
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_empty_query() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();
        
        let result = search_chats("".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 0);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_with_matches() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        let content = r#"{"method":"sendUserMessage","params":{"text":"Hello world"}}
This line contains search term
Another line with different content"#;
        fs::write(&log_file, content).unwrap();
        
        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
        assert!(result[0].matches[0].content_snippet.contains("search term"));
        assert_eq!(result[0].matches[0].line_number, 2);
        assert!(result[0].matches[0].context_before.is_some());
        assert!(result[0].matches[0].context_after.is_some());
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_case_insensitive() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        let content = "This line contains SEARCH TERM";
        fs::write(&log_file, content).unwrap();
        
        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_with_project_filter() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project1_dir = projects_dir.join("project1");
        let project2_dir = projects_dir.join("project2");
        fs::create_dir_all(&project1_dir).unwrap();
        fs::create_dir_all(&project2_dir).unwrap();
        
        // Add matching content to both projects
        let content = "This contains the search term";
        let log1 = project1_dir.join("rpc-log-1640995200000.log");
        let log2 = project2_dir.join("rpc-log-1640995200000.log");
        fs::write(&log1, content).unwrap();
        fs::write(&log2, content).unwrap();
        
        let filters = SearchFilters {
            project_hash: Some("project1".to_string()),
            ..Default::default()
        };
        
        let result = search_chats("search term".to_string(), Some(filters)).await.unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].chat.id.contains("project1"));
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_with_max_results_filter() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        let content = "This contains the search term";
        
        // Create multiple matching log files
        for i in 0..5 {
            let timestamp = 1640995200000u64 + i as u64;
            let log_file = project_dir.join(format!("rpc-log-{}.log", timestamp));
            fs::write(&log_file, content).unwrap();
        }
        
        let filters = SearchFilters {
            max_results: Some(2),
            ..Default::default()
        };
        
        let result = search_chats("search term".to_string(), Some(filters)).await.unwrap();
        assert_eq!(result.len(), 2);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_sorts_by_relevance() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        // Create log with 1 match
        let log1 = project_dir.join("rpc-log-1640995100000.log");
        let content1 = "This contains one match";
        fs::write(&log1, content1).unwrap();
        
        // Create log with 2 matches
        let log2 = project_dir.join("rpc-log-1640995200000.log");
        let content2 = "This contains match\nAnother line with match";
        fs::write(&log2, content2).unwrap();
        
        let result = search_chats("match".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 2);
        // Result with 2 matches should be first (higher relevance score)
        assert_eq!(result[0].matches.len(), 2);
        assert_eq!(result[1].matches.len(), 1);
        assert!(result[0].relevance_score > result[1].relevance_score);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_search_chats_truncates_long_snippets() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        let long_line = format!("{}search term{}", "a".repeat(100), "b".repeat(150));
        fs::write(&log_file, &long_line).unwrap();
        
        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
        assert!(result[0].matches[0].content_snippet.ends_with("..."));
        assert!(result[0].matches[0].content_snippet.len() <= 203); // 200 + "..."
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_project_discussions_nonexistent_project() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let result = get_project_discussions("nonexistent").await.unwrap();
        assert_eq!(result.len(), 0);
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_project_discussions_with_logs() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        // Create log files
        let log1 = project_dir.join("rpc-log-1640995100000.log");
        let log2 = project_dir.join("rpc-log-1640995200000.log");
        let content = r#"{"method":"sendUserMessage","params":{"text":"Test message"}}"#;
        fs::write(&log1, content).unwrap();
        fs::write(&log2, content).unwrap();
        
        let result = get_project_discussions("test_project").await.unwrap();
        assert_eq!(result.len(), 2);
        // Should be sorted by date descending
        assert!(result[0].id.contains("1640995200000"));
        assert!(result[1].id.contains("1640995100000"));
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_get_project_discussions_ignores_invalid_files() {
        let temp_dir = TempDir::new().unwrap();
        unsafe {
            std::env::set_var("HOME", temp_dir.path());
        }
        
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        let project_dir = projects_dir.join("test_project");
        fs::create_dir_all(&project_dir).unwrap();
        
        // Create valid log file
        let valid_log = project_dir.join("rpc-log-1640995200000.log");
        let content = r#"{"method":"sendUserMessage","params":{"text":"Test"}}"#;
        fs::write(&valid_log, content).unwrap();
        
        // Create invalid files
        let invalid_file = project_dir.join("not-a-log.txt");
        fs::write(&invalid_file, "invalid").unwrap();
        let invalid_log = project_dir.join("rpc-log-invalid.log");
        fs::write(&invalid_log, "invalid").unwrap();
        
        let result = get_project_discussions("test_project").await.unwrap();
        assert_eq!(result.len(), 1); // Only the valid log should be included
        
        unsafe {
            std::env::remove_var("HOME");
        }
    }
}
