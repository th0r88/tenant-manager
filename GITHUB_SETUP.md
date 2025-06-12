# GitHub Repository Setup Instructions

## Branch Protection Rules

To complete the setup, enable branch protection rules on GitHub:

### For `main` branch:
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - [x] Require a pull request before merging
   - [x] Require approvals (1)
   - [x] Dismiss stale PR approvals when new commits are pushed
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging
   - [x] Require conversation resolution before merging
   - [x] Restrict pushes that create files > 100MB

### For `develop` branch:
1. Add rule for `develop` branch  
2. Enable:
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging

## Repository Features

Enable these features in Settings → General:
- [x] Issues
- [x] Projects
- [x] Wiki
- [x] Discussions (optional)

## Workflow

After setup:
1. Create feature branches from `develop`: `git checkout -b feature/new-feature develop`
2. Submit PR to `develop` branch
3. Merge `develop` to `main` via PR for releases
4. Use issue templates for bug reports and feature requests
5. Follow PR template checklist

## Status Checks

CI workflow validates:
- Build passes on Node.js 18.x and 20.x
- Frontend builds successfully
- Build artifacts are created
- No build errors or warnings