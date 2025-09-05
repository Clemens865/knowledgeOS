# Claude API Connection Fix - Updated to Claude 4

## Problem
Claude API was returning `not_found_error` for model `claude-3-sonnet-20240229` - this model is deprecated and no longer available.

## Solution
Updated to the latest Claude 4 models:
- **Primary (Recommended)**: `claude-opus-4-1-20250805` (Claude Opus 4.1 - most capable)
- **Fast Option**: `claude-sonnet-4-20250514` (Claude Sonnet 4 - balanced speed/capability)
- **Budget Option**: `claude-3-5-haiku-20241022` (Claude 3.5 Haiku - fastest, cheapest)

## Files Modified
1. **src/core/LLMService.ts**
   - Line 206: Changed default model to `claude-opus-4-1-20250805` (Claude Opus 4.1)

2. **src/main/llmHandlers.ts**
   - Lines 300-304: Updated model list with Claude 4 models

## API Configuration
Ensure your Claude API key is properly configured:
1. Get API key from: https://console.anthropic.com/account/keys
2. Set in app via File → API Keys (Cmd+Shift+K)
3. Select "Claude" as provider
4. Choose model: `claude-opus-4-1-20250805` (recommended) or `claude-sonnet-4-20250514` (faster)

## Testing
After updating:
1. Restart the application
2. Re-initialize LLM with Claude provider
3. Test with a simple message
4. Verify Octopus Mode works with instructions

## API Requirements
- **Endpoint**: `https://api.anthropic.com/v1/messages`
- **Headers**:
  - `x-api-key`: Your API key
  - `anthropic-version`: "2023-06-01"
  - `content-type`: "application/json"
- **Max tokens**: 4096 (configurable)

## Error Resolution
The fix resolves:
- `not_found_error` for deprecated model
- Connection issues with Claude API
- Instruction processing in Octopus Mode