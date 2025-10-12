# Branch Restructure - Quick Start

## What Needs to Be Done
Move commits from PRs #55-#63 off the `main` branch onto a new `post-54` branch, leaving `main` at the state of PR #54.

## Why
The repository owner requested this restructure to keep the main branch aligned with PR #54 for easier comparison and development.

## How to Execute

### Option 1: Automated Script (Recommended)
Run the provided script:
```bash
./restructure-branches.sh
```

The script will:
1. Create a backup of the current main branch
2. Create the `post-54` branch with commits from PRs #55-#63
3. Reset `main` to PR #54
4. Push changes to GitHub

### Option 2: Manual Steps
Follow the detailed instructions in `BRANCH_RESTRUCTURE_INSTRUCTIONS.md`

### Option 3: Dry Run (No Changes)
Test the script without making changes:
```bash
./restructure-branches.sh --dry-run
```

## Prerequisites
- Git repository cloned with full history (not shallow)
- Write access to the repository
- Ability to force-push to `main` (may need to disable branch protection temporarily)

## Important Notes
- ⚠️ This operation requires force-pushing to `main`
- ✅ A backup branch will be created automatically
- ✅ No commits will be lost - they'll be on `post-54`
- 🔄 Operation can be rolled back if needed

## Files Included
- `BRANCH_RESTRUCTURE.md` - Overview and status
- `BRANCH_RESTRUCTURE_INSTRUCTIONS.md` - Detailed manual instructions
- `restructure-branches.sh` - Automated script
- `BRANCH_RESTRUCTURE_README.md` - This file

## Need Help?
Review the detailed instructions in `BRANCH_RESTRUCTURE_INSTRUCTIONS.md` or contact the repository maintainer.

## Verification After Execution
After running the script, verify:
1. Main branch ends at PR #54: https://github.com/doenjon/buckEuchre/commits/main
2. Post-54 branch exists: https://github.com/doenjon/buckEuchre/tree/post-54
3. Post-54 contains PRs #55-#63: https://github.com/doenjon/buckEuchre/commits/post-54
