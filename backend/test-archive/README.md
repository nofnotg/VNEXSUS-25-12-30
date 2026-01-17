# Test Archive

**Created:** 2026-01-17
**Purpose:** Phase 1-4 cleanup - consolidate scattered test files

## Why These Files Were Archived

These test files were scattered throughout the repository without clear organization. They have been moved to this archive directory to:

1. **Reduce clutter** in root and working directories
2. **Preserve code** for potential future reference
3. **Maintain safety** - no deletion, just reorganization
4. **Keep working pipeline intact** - actively used tests remain in place

## What Was NOT Moved

- `backend/tests/` - Already properly organized (unit/, integration/, load/)
- `tests/` - Root-level organized tests
- `test-progressive-rag.js` - Actively used in package.json scripts
- Any files confirmed to be part of active pipeline

## Archive Structure

- `root-tests/` - Test files from repository root
- `postprocess-tests/` - Test files from backend/postprocess/
- `tools-tests/` - Test files from backend/tools/
- `scripts-tests/` - Test files from scripts/
- `other-tests/` - Test files from other locations

## If You Need These Tests

These files are **git tracked** and can be:
1. Retrieved from this archive directory
2. Restored from git history
3. Referenced for debugging legacy behavior

## Rollback Point

All changes were committed to git before archiving. See commit history for rollback.
