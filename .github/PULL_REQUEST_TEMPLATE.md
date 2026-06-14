## Pull Request: SHAHID Platform

<!-- Please read the Contributing section in README.md before submitting -->

### Related SRS Requirement

- **Requirement ID**: `FR-` / `NFR-` / `AC-` (e.g., `FR-1.2`, `NFR-2.1`)
- **Master Blueprint Version**: v3.0 Final

### Summary

<!-- Provide a concise summary of what this PR changes -->

### Changes Introduced

- [ ] Feature (new capability)
- [ ] Bug fix (corrects an issue)
- [ ] Refactor (no functional change)
- [ ] Documentation update
- [ ] Database migration
- [ ] Infrastructure / CI-CD change

### Screenshots / Evidence

<!-- Required for UI changes. Include RTL Arabic QA screenshots for web/mobile. -->

| Before | After |
|--------|-------|
| (paste) | (paste) |

### Testing

- [ ] Unit tests added / updated (coverage ≥ 70% for business logic)
- [ ] Integration test passed (`docker-compose` stack)
- [ ] Lint passes (`npm run lint`, `flutter analyze`, `ruff check`)
- [ ] Security: OWASP Top 10 checked for auth / data changes
- [ ] RTL check: Arabic layout verified (zero overflow / reversed icons)
- [ ] DB migration: rollback plan documented (if applicable)

### Checklist

- [ ] I have read the `CONTRIBUTING.md` and `README.md` guidelines
- [ ] My code follows the project style and naming conventions
- [ ] I have not committed any `.env` files or credentials
- [ ] Commit messages follow the `type(scope): description` convention
- [ ] This PR targets the correct branch (`develop` for features, `main` for hotfixes)

### Deployment Notes

- [ ] Requires new environment variable(s) (documented below)
- [ ] Requires database migration run on deployment
- [ ] Requires infrastructure change (e.g., new S3 bucket, IAM policy)
- [ ] No special deployment steps required

**New environment variables:**
```bash
# List any new env vars here
```

### Reviewers

<!-- CODEOWNERS will auto-assign; add manual reviewers if cross-team -->

- @shahid-platform/architects
- [ ] Backend Lead approved (if API/DB change)
- [ ] Frontend Lead approved (if UI change)
- [ ] DevOps Lead approved (if infra/CI change)
