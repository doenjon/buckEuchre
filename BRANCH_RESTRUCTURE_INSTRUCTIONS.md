# Branch Restructure Instructions

## Overview
This document provides step-by-step instructions to move all commits after PR #54 from the `main` branch to a new `post-54` branch, leaving `main` at the state immediately after PR #54 was merged.

## Background
PR #64 attempted to restructure the branch but did not successfully remove commits #55-#63 from the `main` branch history. This document describes how to complete the restructure properly.

## Current State (Before Restructure)
- **main branch HEAD**: `7e0ad2ffc13aabf12e5ca85677d6664d20782577` (PR #64 merge)
- **main branch includes**: All commits from PRs #1-#64
- **post-54 branch**: Does not exist

## Target State (After Restructure)  
- **main branch HEAD**: `30504672826400119f1283878caf78c6080c7d8b` (PR #54 merge)
- **main branch includes**: All commits from PRs #1-#54 only
- **post-54 branch HEAD**: `3691d0520c9e64a511b1de11efc6874d89e1e18f` (PR #63 merge)
- **post-54 branch includes**: All commits from PRs #1-#63

## Commits Being Preserved on post-54 Branch
The following 9 PRs (and their commits) will be moved from `main` to the new `post-54` branch:

1. **PR #55** (30504672 → 4e3fe6dd): Improve mobile card layouts
2. **PR #56** (4e3fe6dd → 20fe8002): Fix PlayerHand card size typing  
3. **PR #57** (20fe8002 → baa5b8eb): Fix PlayerHand card size typing
4. **PR #58** (baa5b8eb → f020f744): Fix mobile hand layout regression
5. **PR #59** (f020f744 → cef83cda): Fix mobile hand layout regression
6. **PR #60** (cef83cda → e3d06adb): Fix mobile card pip scaling
7. **PR #61** (e3d06adb → 1a85a398): Fix mobile game screen overflow
8. **PR #62** (1a85a398 → 70405b92): Revamp playing card visuals
9. **PR #63** (70405b92 → 3691d052): Fix frontend rank labels

**Total commits being moved**: ~18 commits (including merge commits and individual commits)

## Prerequisites
- Git repository cloned locally
- Admin/write access to the repository
- Ability to force-push to `main` branch (or permission to temporarily disable branch protection)

## Step-by-Step Instructions

### Step 1: Backup Current State (IMPORTANT!)
Before making any changes, create a backup branch:

```bash
# Navigate to repository
cd /path/to/buckEuchre

# Fetch latest changes
git fetch origin

# Create backup of current main
git branch main-backup-$(date +%Y%m%d) origin/main
git push origin main-backup-$(date +%Y%m%d)
```

### Step 2: Create post-54 Branch
Create the `post-54` branch pointing to the last commit before the revert (PR #63):

```bash
# Create branch locally from PR #63 commit
git branch post-54 3691d0520c9e64a511b1de11efc6874d89e1e18f

# Push to remote
git push origin post-54
```

**Verify**: Visit https://github.com/doenjon/buckEuchre/tree/post-54 and confirm the branch exists.

### Step 3: Reset main Branch to PR #54
Reset the `main` branch to end at PR #54:

```bash
# Fetch main if not already on it
git fetch origin main
git checkout main

# Reset to PR #54 commit (THIS REMOVES COMMITS FROM HISTORY)
git reset --hard 30504672826400119f1283878caf78c6080c7d8b

# Verify you're at the right commit
git log --oneline -5
# Should show PR #54 "Merge pull request #54..." as the top commit

# Force push to remote (REQUIRES FORCE PUSH PERMISSION)
git push --force origin main
```

**⚠️ Warning**: This step requires force-pushing to `main`. If branch protection is enabled:
1. Temporarily disable branch protection rules in GitHub settings
2. Complete the push  
3. Re-enable branch protection rules

### Step 4: Verify the Restructure

#### Verify main branch:
```bash
git checkout main
git log --oneline -5
```
Expected output:
```
3050467 Merge pull request #54 from doenjon/codex/fix-next-hand-popup-visibility-on-fold
9f82dfb Fix next hand popup for folded players
ebef4ad Merge pull request #53...
[older commits]
```

#### Verify post-54 branch:
```bash
git checkout post-54
git log --oneline -15
```
Expected output should show PRs #55-#63 in the history.

#### Verify no commits were lost:
```bash
# This should show all commits in post-54 that aren't in main (should be ~18 commits)
git log --oneline post-54 ^main | wc -l
```
Expected: ~18-20 commits

### Step 5: Update Documentation
Update BRANCH_RESTRUCTURE.md to reflect the actual changes:

```bash
# Edit the file to mark completion
git checkout main
# (Edit BRANCH_RESTRUCTURE.md to confirm the restructure was completed)
git add BRANCH_RESTRUCTURE.md
git commit -m "Confirm branch restructure completion"
git push origin main
```

### Step 6: Clean Up (Optional)
Remove the temporary backup branch if everything looks good:

```bash
git branch -d main-backup-YYYYMMDD
git push origin --delete main-backup-YYYYMMDD
```

## Rollback Plan (If Something Goes Wrong)
If you need to undo the restructure:

```bash
# Restore main from backup
git checkout main
git reset --hard origin/main-backup-YYYYMMDD
git push --force origin main

# Delete post-54 if needed
git push origin --delete post-54
```

## Validation Checklist
After completing the restructure, verify:

- [ ] `main` branch ends at PR #54 commit (3050467)
- [ ] `post-54` branch exists and contains PRs #55-#63
- [ ] No commits were lost (verify with `git log post-54 ^main`)
- [ ] All workflows and integrations still work
- [ ] Documentation updated to reflect the changes
- [ ] Backup branch created and can be used for rollback if needed

## Questions or Issues?
If you encounter any problems:
1. Do NOT proceed if unsure
2. Check the rollback plan above
3. Verify you have proper backups
4. Ask for help if needed

## References
- PR #54 commit: https://github.com/doenjon/buckEuchre/commit/30504672826400119f1283878caf78c6080c7d8b
- PR #63 commit: https://github.com/doenjon/buckEuchre/commit/3691d0520c9e64a511b1de11efc6874d89e1e18f
- PR #64: https://github.com/doenjon/buckEuchre/pull/64
