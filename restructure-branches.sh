#!/usr/bin/env bash
#
# Branch Restructure Script
# =========================
# This script moves all commits after PR #54 from main to a new post-54 branch.
#
# WARNING: This script will force-push to the main branch!
# Make sure you have proper backups before running.
#
# Usage: ./restructure-branches.sh [--dry-run]
#

set -euo pipefail

# Configuration
PR_54_COMMIT="30504672826400119f1283878caf78c6080c7d8b"
PR_63_COMMIT="3691d0520c9e64a511b1de11efc6874d89e1e18f"
POST_54_BRANCH="post-54"
MAIN_BRANCH="main"
BACKUP_BRANCH="main-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}Running in DRY RUN mode - no changes will be pushed${NC}"
fi

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

confirm() {
    local prompt="$1"
    read -r -p "$prompt [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Check we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository!"
    exit 1
fi

# Check we have the required commits
log_info "Checking for required commits..."
if ! git cat-file -e "$PR_54_COMMIT" 2>/dev/null; then
    log_error "PR #54 commit not found: $PR_54_COMMIT"
    log_error "You may need to fetch: git fetch origin"
    exit 1
fi

if ! git cat-file -e "$PR_63_COMMIT" 2>/dev/null; then
    log_error "PR #63 commit not found: $PR_63_COMMIT"  
    log_error "You may need to unshallow: git fetch --unshallow"
    exit 1
fi

log_info "All required commits found"

# Confirm with user
echo ""
log_warn "This script will:"
echo "  1. Create a backup branch: $BACKUP_BRANCH"
echo "  2. Create $POST_54_BRANCH branch from commit $PR_63_COMMIT"
echo "  3. Reset $MAIN_BRANCH to commit $PR_54_COMMIT (REMOVES COMMITS FROM HISTORY)"
echo "  4. Force push $MAIN_BRANCH to remote"
echo ""
log_warn "This is a DESTRUCTIVE operation that requires force-push!"
echo ""

if ! $DRY_RUN; then
    if ! confirm "Do you want to continue?"; then
        log_info "Aborted by user"
        exit 0
    fi
fi

# Step 1: Create backup
log_info "Step 1/5: Creating backup branch..."
git branch "$BACKUP_BRANCH" "origin/$MAIN_BRANCH" 2>/dev/null || \
    git branch "$BACKUP_BRANCH" "$MAIN_BRANCH"

if ! $DRY_RUN; then
    git push origin "$BACKUP_BRANCH"
    log_info "Backup created: $BACKUP_BRANCH"
else
    log_info "[DRY RUN] Would create backup: $BACKUP_BRANCH"
fi

# Step 2: Create post-54 branch
log_info "Step 2/5: Creating $POST_54_BRANCH branch..."
if git rev-parse --verify "$POST_54_BRANCH" >/dev/null 2>&1; then
    log_warn "Branch $POST_54_BRANCH already exists locally"
    if confirm "Delete and recreate it?"; then
        git branch -D "$POST_54_BRANCH"
    else
        log_error "Cannot proceed with existing branch"
        exit 1
    fi
fi

git branch "$POST_54_BRANCH" "$PR_63_COMMIT"

if ! $DRY_RUN; then
    git push origin "$POST_54_BRANCH"
    log_info "Created and pushed $POST_54_BRANCH"
else
    log_info "[DRY RUN] Would create and push $POST_54_BRANCH"
fi

# Step 3: Checkout main
log_info "Step 3/5: Checking out $MAIN_BRANCH..."
git checkout "$MAIN_BRANCH"

# Step 4: Reset main to PR #54
log_info "Step 4/5: Resetting $MAIN_BRANCH to PR #54..."
log_warn "This will remove commits #55-#63 from $MAIN_BRANCH history"

if ! $DRY_RUN; then
    if confirm "Are you SURE you want to reset $MAIN_BRANCH?"; then
        git reset --hard "$PR_54_COMMIT"
        log_info "Reset $MAIN_BRANCH to $PR_54_COMMIT"
    else
        log_error "Reset cancelled by user"
        log_info "Cleaning up: removing $POST_54_BRANCH"
        git push origin --delete "$POST_54_BRANCH" 2>/dev/null || true
        exit 1
    fi
else
    log_info "[DRY RUN] Would reset $MAIN_BRANCH to $PR_54_COMMIT"
fi

# Step 5: Force push main
log_info "Step 5/5: Force pushing $MAIN_BRANCH..."
if ! $DRY_RUN; then
    log_warn "About to force push to $MAIN_BRANCH!"
    if confirm "Push to remote?"; then
        git push --force origin "$MAIN_BRANCH"
        log_info "Force pushed $MAIN_BRANCH"
    else
        log_error "Push cancelled"
        log_warn "Local $MAIN_BRANCH has been reset but not pushed"
        log_warn "Run 'git reset --hard origin/$MAIN_BRANCH' to undo local changes"
        exit 1
    fi
else
    log_info "[DRY RUN] Would force push $MAIN_BRANCH"
fi

# Verification
echo ""
log_info "Verification:"
echo ""

echo "Main branch (should end at PR #54):"
git log "$MAIN_BRANCH" --oneline -5

echo ""
echo "Post-54 branch (should include PRs #55-#63):"
git log "$POST_54_BRANCH" --oneline -15 | head -n 10

echo ""
MOVED_COMMITS=$(git rev-list --count "$POST_54_BRANCH" ^"$MAIN_BRANCH")
log_info "Number of commits moved to $POST_54_BRANCH: $MOVED_COMMITS"

if [ "$MOVED_COMMITS" -ge 15 ] && [ "$MOVED_COMMITS" -le 25 ]; then
    log_info "✓ Commit count looks correct (expected ~18-20)"
else
    log_warn "⚠ Unexpected commit count (expected ~18-20, got $MOVED_COMMITS)"
fi

# Success
echo ""
log_info "Branch restructure completed successfully!"
echo ""
log_info "Summary:"
echo "  - Main branch reset to PR #54"
echo "  - Post-54 branch created with PRs #55-#63"
echo "  - Backup branch: $BACKUP_BRANCH"
echo ""
log_info "Next steps:"
echo "  1. Verify the branches look correct on GitHub"
echo "  2. Update documentation (BRANCH_RESTRUCTURE.md)"
echo "  3. Notify team members about the change"
echo "  4. Delete backup branch once confident: git push origin --delete $BACKUP_BRANCH"
echo ""
