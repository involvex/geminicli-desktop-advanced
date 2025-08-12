use crate::types::BackendResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub description: String,
    pub url: String,
    pub repository: Option<String>,
    pub category: String,
    pub stars: u32,
    pub language: Option<String>,
    pub install_command: Option<String>,
    pub config_example: Option<String>,
    pub tags: Vec<String>,
}

/// Search MCP servers from various sources
pub async fn search_mcp_servers(query: Option<String>) -> BackendResult<Vec<McpServerInfo>> {
    let mut servers = get_builtin_mcp_servers();
    
    // Add GitHub search results if available
    if let Ok(github_servers) = search_github_mcp_servers(query.as_deref()).await {
        servers.extend(github_servers);
    }
    
    // Filter by query if provided
    if let Some(q) = query {
        let q_lower = q.to_lowercase();
        servers.retain(|server| {
            server.name.to_lowercase().contains(&q_lower) ||
            server.description.to_lowercase().contains(&q_lower) ||
            server.tags.iter().any(|tag| tag.to_lowercase().contains(&q_lower))
        });
    }
    
    // Sort by stars descending
    servers.sort_by(|a, b| b.stars.cmp(&a.stars));
    
    Ok(servers)
}

fn get_builtin_mcp_servers() -> Vec<McpServerInfo> {
    vec![
        McpServerInfo {
            name: "filesystem".to_string(),
            description: "Access and manipulate files and directories".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "filesystem".to_string(),
            stars: 1250,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-filesystem".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    }
  }
}"#.to_string()),
            tags: vec!["files".to_string(), "directories".to_string(), "io".to_string()],
        },
        McpServerInfo {
            name: "git".to_string(),
            description: "Git repository operations and version control".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/git".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "development".to_string(),
            stars: 980,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-git".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "/path/to/git/repo"]
    }
  }
}"#.to_string()),
            tags: vec!["git".to_string(), "version-control".to_string(), "repository".to_string()],
        },
        McpServerInfo {
            name: "postgres".to_string(),
            description: "PostgreSQL database operations and queries".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "database".to_string(),
            stars: 750,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-postgres".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@localhost/dbname"]
    }
  }
}"#.to_string()),
            tags: vec!["database".to_string(), "sql".to_string(), "postgres".to_string()],
        },
        McpServerInfo {
            name: "brave-search".to_string(),
            description: "Web search using Brave Search API".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "search".to_string(),
            stars: 650,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-brave-search".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}"#.to_string()),
            tags: vec!["search".to_string(), "web".to_string(), "brave".to_string()],
        },
        McpServerInfo {
            name: "sqlite".to_string(),
            description: "SQLite database operations and queries".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "database".to_string(),
            stars: 580,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-sqlite".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "/path/to/database.db"]
    }
  }
}"#.to_string()),
            tags: vec!["database".to_string(), "sql".to_string(), "sqlite".to_string()],
        },
        McpServerInfo {
            name: "github".to_string(),
            description: "GitHub repository and issue management".to_string(),
            url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github".to_string(),
            repository: Some("https://github.com/modelcontextprotocol/servers".to_string()),
            category: "development".to_string(),
            stars: 890,
            language: Some("TypeScript".to_string()),
            install_command: Some("npm install @modelcontextprotocol/server-github".to_string()),
            config_example: Some(r#"{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}"#.to_string()),
            tags: vec!["github".to_string(), "repository".to_string(), "issues".to_string()],
        },
    ]
}

async fn search_github_mcp_servers(_query: Option<&str>) -> BackendResult<Vec<McpServerInfo>> {
    // In a real implementation, this would search GitHub for MCP servers
    // For now, return empty to avoid API rate limits
    Ok(vec![])
}

/// Get MCP server categories for filtering
pub fn get_mcp_categories() -> Vec<String> {
    vec![
        "filesystem".to_string(),
        "development".to_string(),
        "database".to_string(),
        "search".to_string(),
        "ai".to_string(),
        "productivity".to_string(),
        "communication".to_string(),
        "media".to_string(),
    ]
}

/// Get popular MCP servers
pub async fn get_popular_mcp_servers(limit: usize) -> BackendResult<Vec<McpServerInfo>> {
    let mut servers = search_mcp_servers(None).await?;
    servers.truncate(limit);
    Ok(servers)
}