# Branch Restructure Execution Checklist

Use this checklist when executing the branch restructure.

## Pre-Execution Checklist

- [ ] Repository cloned locally with full history (not shallow)
  ```bash
  git fetch --unshallow  # If needed
  ```

- [ ] On the correct repository
  ```bash
  git remote -v  # Should show doenjon/buckEuchre
  ```

- [ ] Have admin/write access to repository
  ```bash
  git push --dry-run  # Test write access
  ```

- [ ] All local changes committed or stashed
  ```bash
  git status  # Should be clean
  ```

- [ ] Required commits are accessible
  ```bash
  git cat-file -e 30504672826400119f1283878caf78c6080c7d8b  # PR #54
  git cat-file -e 3691d0520c9e64a511b1de11efc6874d89e1e18f  # PR #63
  ```

- [ ] Notified team members about upcoming change
  - [ ] Informed collaborators main branch will be force-pushed
  - [ ] Suggested they push any pending work before restructure

## Execution Options

Choose one:

### Option A: Automated Script (Recommended)
- [ ] Script is executable
  ```bash
  chmod +x restructure-branches.sh
  ```

- [ ] Run dry-run first
  ```bash
  ./restructure-branches.sh --dry-run
  ```

- [ ] Review dry-run output

- [ ] Execute for real
  ```bash
  ./restructure-branches.sh
  ```

### Option B: Manual Execution
- [ ] Follow steps in `BRANCH_RESTRUCTURE_INSTRUCTIONS.md`

## During Execution

- [ ] Backup branch created successfully
- [ ] post-54 branch created and pushed
- [ ] main branch reset to PR #54
- [ ] Force push to main completed

## Post-Execution Verification

### Verify main Branch
- [ ] Main branch HEAD is at PR #54
  ```bash
  git log main --oneline -3
  ```
  Expected: Top commit is "Merge pull request #54..."

- [ ] Main branch on GitHub matches local
  - [ ] Visit: https://github.com/doenjon/buckEuchre/commits/main
  - [ ] Confirm latest commit is PR #54

### Verify post-54 Branch  
- [ ] post-54 branch exists
  ```bash
  git branch -r | grep post-54
  ```

- [ ] post-54 HEAD is at PR #63
  ```bash
  git log post-54 --oneline -3
  ```
  Expected: Top commit is "Merge pull request #63..."

- [ ] post-54 branch on GitHub is correct
  - [ ] Visit: https://github.com/doenjon/buckEuchre/tree/post-54
  - [ ] Confirm branch exists
  - [ ] Visit: https://github.com/doenjon/buckEuchre/commits/post-54
  - [ ] Confirm latest commit is PR #63

### Verify No Commits Lost
- [ ] Count commits moved
  ```bash
  git rev-list --count post-54 ^main
  ```
  Expected: ~18-20 commits

- [ ] Review commits on post-54 not on main
  ```bash
  git log --oneline post-54 ^main | head -n 20
  ```
  Expected: Should see PRs #55-#63

### Verify GitHub State
- [ ] Compare branches on GitHub
  - [ ] Visit: https://github.com/doenjon/buckEuchre/compare/main...post-54
  - [ ] Confirm 9 PRs difference shown

- [ ] Check workflows still work
  - [ ] Visit: https://github.com/doenjon/buckEuchre/actions
  - [ ] Verify no broken workflows

- [ ] Check branch protection rules
  - [ ] Verify main branch protection is re-enabled (if it was disabled)

## Documentation Updates

- [ ] Update BRANCH_RESTRUCTURE.md
  - [ ] Change status from "PENDING" to "COMPLETED"
  - [ ] Add execution date
  - [ ] Add executed by name

- [ ] Commit documentation update
  ```bash
  git checkout main
  # Edit BRANCH_RESTRUCTURE.md
  git add BRANCH_RESTRUCTURE.md
  git commit -m "Mark branch restructure as completed"
  git push origin main
  ```

## Team Communication

- [ ] Notify team members restructure is complete
  - [ ] Main branch now ends at PR #54
  - [ ] New post-54 branch created with PRs #55-#63
  - [ ] Team members need to update their local repos

- [ ] Share update instructions for team
  ```bash
  # For team members to update their local repos:
  git fetch origin
  git checkout main
  git reset --hard origin/main
  git checkout -b post-54 origin/post-54
  ```

## Cleanup (After Verification)

- [ ] Wait at least 24 hours after restructure
- [ ] Confirm everything is working correctly
- [ ] Delete backup branch (optional)
  ```bash
  git push origin --delete main-backup-YYYYMMDD-HHMMSS
  git branch -d main-backup-YYYYMMDD-HHMMSS
  ```

## Rollback Plan (If Needed)

If something goes wrong, rollback using:

```bash
# Restore main from backup
git checkout main
git reset --hard origin/main-backup-YYYYMMDD-HHMMSS
git push --force origin main

# Delete post-54 if needed
git push origin --delete post-54
```

- [ ] Rollback executed (if needed)
- [ ] Team notified of rollback (if needed)

## Final Verification

- [ ] All items above completed
- [ ] No errors or warnings
- [ ] Team notified
- [ ] Documentation updated

## Notes

Date executed: _________________

Executed by: _________________

Issues encountered: _________________

Resolution: _________________

## Reference

- PR #54 commit: `30504672826400119f1283878caf78c6080c7d8b`
- PR #63 commit: `3691d0520c9e64a511b1de11efc6874d89e1e18f`
- Backup branch name: `main-backup-YYYYMMDD-HHMMSS`
