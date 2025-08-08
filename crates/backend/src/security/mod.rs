use crate::types::{BackendError, BackendResult};
use tokio::process::Command;

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
