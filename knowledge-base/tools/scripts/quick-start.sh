#!/bin/bash

# KnowledgeOS Quick Start Script
# Initialize your repository as an AI assistant

echo "🧠 KnowledgeOS - Repository as Assistant Setup"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "WORKSPACE_RULES.md" ]; then
    echo "⚠️  WORKSPACE_RULES.md not found!"
    echo "Please run this script from the KnowledgeOS root directory."
    exit 1
fi

echo "✅ Found WORKSPACE_RULES.md"
echo ""

# Create today's conversation file
TODAY=$(date +%Y-%m-%d)
CONV_FILE="knowledge-base/conversations/daily/${TODAY}.md"

if [ ! -f "$CONV_FILE" ]; then
    echo "📝 Creating today's conversation file..."
    cat > "$CONV_FILE" << EOF
---
created: ${TODAY}
updated: ${TODAY}
type: conversation
tags: [daily, conversation]
connections: []
importance: medium
---

# Daily Conversations - ${TODAY}

## Summary
Conversations and interactions for ${TODAY}.

## Morning Session
*No conversations yet*

## Afternoon Session
*No conversations yet*

## Evening Session
*No conversations yet*

## Key Insights
- 

## Action Items
- [ ] 

## Connections
- Related to: 
- See also: 

## Metadata
- Source: conversation
- Confidence: high
- Review date: $(date -d '+7 days' +%Y-%m-%d 2>/dev/null || date -v +7d +%Y-%m-%d 2>/dev/null || echo "${TODAY}")
EOF
    echo "✅ Created: $CONV_FILE"
else
    echo "✅ Today's conversation file already exists"
fi

echo ""

# Create a goals file if it doesn't exist
GOALS_FILE="knowledge-base/personal/goals.md"
if [ ! -f "$GOALS_FILE" ]; then
    echo "🎯 Creating goals file..."
    cat > "$GOALS_FILE" << EOF
---
created: ${TODAY}
updated: ${TODAY}
type: personal
tags: [goals, objectives, planning]
connections: [projects/active/]
importance: high
---

# Personal Goals

## Summary
Short-term and long-term objectives.

## Current Focus
- [ ] Set up KnowledgeOS repository
- [ ] Build knowledge base through daily use
- [ ] Develop helpful scripts and tools

## Short-term Goals (3 months)
- [ ] 
- [ ] 
- [ ] 

## Long-term Goals (1 year)
- [ ] 
- [ ] 
- [ ] 

## Success Metrics
- 
- 
- 

## Connections
- Related to: [[projects/active/]]
- See also: [[personal/values.md]]

## Metadata
- Source: personal
- Confidence: high
- Review date: $(date -d '+30 days' +%Y-%m-%d 2>/dev/null || date -v +30d +%Y-%m-%d 2>/dev/null || echo "${TODAY}")
EOF
    echo "✅ Created: $GOALS_FILE"
else
    echo "✅ Goals file already exists"
fi

echo ""

# Count existing files
FILE_COUNT=$(find knowledge-base -name "*.md" -type f 2>/dev/null | wc -l)
echo "📊 Current Status:"
echo "   - Knowledge files: $FILE_COUNT"
echo "   - Folder structure: ✅"
echo "   - Rules defined: ✅"
echo ""

# Show next steps
echo "🚀 Next Steps:"
echo "   1. Open this folder in VS Code, Cursor, or Windsurf"
echo "   2. Read WORKSPACE_RULES.md to understand the system"
echo "   3. Start having conversations - the AI will follow the rules"
echo "   4. Watch your knowledge base grow with each interaction"
echo ""
echo "💡 Tips:"
echo "   - Everything is stored in markdown files"
echo "   - The AI organizes information based on the rules"
echo "   - Cross-references are created automatically"
echo "   - Your repository becomes smarter over time"
echo ""
echo "📚 Documentation:"
echo "   - WORKSPACE_RULES.md - How the system works"
echo "   - PARADIGM_SHIFT.md - The vision and philosophy"
echo "   - PROJECT_CONTEXT.md - Technical details"
echo ""
echo "✨ Your repository is now your AI assistant!"
echo "   Start talking to it through your AI coding tool."
echo ""