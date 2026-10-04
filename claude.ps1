Write-Host "====================================================" -ForegroundColor cyan
Write-Host " Setting up DeepSeek Environment Variables" -ForegroundColor magenta
Write-Host "====================================================" -ForegroundColor cyan
Write-Host ""

# Set Base URL
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"

# Auth token — NEVER hardcode a key here (this file is in git).
# Load order: 1) DEEPSEEK_API_KEY in your shell env, 2) a local
# gitignored file `deepseek.token` next to this script.
if ($env:DEEPSEEK_API_KEY) {
    $env:ANTHROPIC_AUTH_TOKEN = $env:DEEPSEEK_API_KEY
} elseif (Test-Path "$PSScriptRoot\deepseek.token") {
    $env:ANTHROPIC_AUTH_TOKEN = (Get-Content "$PSScriptRoot\deepseek.token" -Raw).Trim()
} else {
    Write-Host "ERROR: No DeepSeek API key found." -ForegroundColor Red
    Write-Host "  Set DEEPSEEK_API_KEY, or put the key in deepseek.token (gitignored)." -ForegroundColor Yellow
    exit 1
}

# Set Model Overrides
$env:ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"

# Set Effort Level
$env:CLAUDE_CODE_EFFORT_LEVEL="max"

Write-Host "Environment variables have been set for this session." -ForegroundColor Green
Write-Host ""

# Enter the project directory and execute the claude command to get started
Write-Host "Starting Claude Code..." -ForegroundColor Yellow
cd "C:\Users\Santiago Arizpe\OneDrive\Desktop\landing_workspace"  # <--- CHANGE THIS TO YOUR ACTUAL PROJECT FOLDER PATH
claude
