# Contributing to Tenant Manager

## Development Guidelines

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone <your-fork-url>
   cd tennants
   npm install
   ```

2. **Branch from develop**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

### Development Workflow

1. **Feature Development**
   - Create feature branch: `feature/description`
   - Make changes with clear, focused commits
   - Test locally before pushing

2. **Bug Fixes**
   - Create bugfix branch: `bugfix/description`
   - Include reproduction steps in PR
   - Add tests if applicable

3. **Hotfixes**
   - Create hotfix branch: `hotfix/critical-issue`
   - Branch from main for production fixes
   - Merge back to both main and develop

### Code Standards

- **JavaScript/React**: Use modern ES6+ syntax
- **CSS**: Use DaisyUI classes, avoid custom CSS
- **File Structure**: Keep components modular
- **Database**: Use prepared statements, handle errors
- **API**: RESTful endpoints with proper HTTP codes

### Commit Messages

Follow conventional commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `style:` formatting, no code change
- `refactor:` code change that neither fixes bug nor adds feature
- `chore:` updating build tasks, package manager configs

### Testing

Before submitting PR:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] Frontend loads and functions properly
- [ ] Backend API endpoints work correctly
- [ ] Manual testing of affected features

### Pull Request Process

1. **Prepare PR**
   - Update documentation if needed
   - Ensure all tests pass
   - Fill out PR template completely

2. **Review Process**
   - Address all review comments
   - Keep commits focused and atomic
   - Rebase if needed to maintain clean history

3. **Merge Process**
   - Squash commits for features
   - Merge commit for releases
   - Delete feature branch after merge

### Code Review Guidelines

**For Reviewers:**
- Focus on logic, performance, security
- Check for proper error handling
- Verify UI/UX consistency
- Test the changes locally

**For Authors:**
- Respond to all comments
- Ask questions if unclear
- Make requested changes promptly
- Update tests if needed

### Release Process

1. **Feature Release**
   - Merge feature branches to develop
   - Test develop branch thoroughly
   - Create release PR from develop to main

2. **Version Management**
   - Update package.json version
   - Create git tag for releases
   - Document changes in releases

### Need Help?

- Create an issue for questions
- Use discussions for ideas
- Tag maintainers for urgent issues