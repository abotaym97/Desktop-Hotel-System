# OMDA desktop

- The user explicitly authorized a separate Windows desktop project on 9 November 2026. Keep it inside Desktop-System; preserve Mobile-System and F:\Hotel Project.
- Reuse the React source from ../Frontend-System during build. Do not fork page components or business rules into a second UI source. Renderer output belongs here, not in Frontend-System/build.
- The user confirmed https://web-production-4e786.up.railway.app/api/ for the released desktop client. Acceptance tests must use the isolated local Django test server, synthetic users and a separate Electron profile. Never perform financial operations on the hosted service to test the app.
- Retain nodeIntegration=false, contextIsolation=true, sandbox=true and webSecurity=true. Do not bypass certificate validation, CSRF or branch/staff permissions. API/media requests must retain Chromium session cookies and TLS; credentials must not be bundled.
- Release builds ignore development API/profile/renderer environment overrides. Do not publish builds, configure signing services or upload updates unless authorized.
- Verify npm test, npm run dist and isolated Electron acceptance when changing the runtime. Use ../scripts/manage-backend.ps1 for Django commands. The acceptance test is hotels.test_desktop_browser_qa (RUN_DESKTOP_QA=1 and PLAYWRIGHT_MODULE configured).
- Keep renderer, artifacts, node_modules, .qa, session data and signing private keys out of source control. Update README_AR.md and root/backend handoff documents after material changes.
