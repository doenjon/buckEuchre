#!/bin/bash

# ==============================================================================
# Filter and Highlight Stats Logs
# ==============================================================================
# 
# This script filters backend logs to show only stats-related messages
# with color highlighting for better visibility
# 
# Usage:
#   ./filter-stats-logs.sh                    # Filter from stdin
#   tail -f backend.log | ./filter-stats-logs.sh  # Follow a log file
#   npm run dev 2>&1 | ./filter-stats-logs.sh    # Filter live backend output
# 
# ==============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Filter and highlight stats-related logs
grep --line-buffered -E "\[STATS|\[updateRoundStats|\[updateGameStats|stats|Stats" | \
while IFS= read -r line; do
    # Highlight different types of stats logs
    if echo "$line" | grep -q "\[STATS BUILD\]"; then
        echo -e "${CYAN}${line}${NC}"
    elif echo "$line" | grep -q "\[STATS PERSIST\]"; then
        echo -e "${MAGENTA}${line}${NC}"
    elif echo "$line" | grep -q "\[updateRoundStats\]"; then
        echo -e "${GREEN}${line}${NC}"
    elif echo "$line" | grep -q "\[updateGameStats\]"; then
        echo -e "${BLUE}${line}${NC}"
    elif echo "$line" | grep -q "Error\|error\|ERROR\|Failed\|failed"; then
        echo -e "${RED}${line}${NC}"
    else
        echo -e "${YELLOW}${line}${NC}"
    fi
done

