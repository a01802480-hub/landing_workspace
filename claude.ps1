Write-Host "====================================================" -ForegroundColor cyan
Write-Host " Setting up DeepSeek Environment Variables" -ForegroundColor magenta
Write-Host "====================================================" -ForegroundColor cyan
Write-Host ""

# Set Base URL and Auth Token
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="sk-761240509ed34f6d9a9620242d1569a5"

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
cd "C:\Users\Santiago Arizpe\OneDrive\Desktop\Global-Innovation-Build-Challenge-V2"  # <--- CHANGE THIS TO YOUR ACTUAL PROJECT FOLDER PATH
claude