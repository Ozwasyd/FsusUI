# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: markdown-interaction-trace.spec.ts >> traces MarkdownEditor input, paste, drop, exposed methods, and public state
- Location: vue/tests/markdown-editor/markdown-interaction-trace.spec.ts:445:5

# Error details

```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
Call log:
  - <launching> /workspace/.setup/ms-playwright/firefox-1511/firefox/firefox -no-remote -headless -profile /tmp/playwright_firefoxdev_profile-u65Iuw -juggler-pipe -silent
  - <launched> pid=422924
  - [pid=422924][err] *** You are running in headless mode.
  30 × [pid=422924][err] Fontconfig error: No writable cache directories
  - [pid=422924][err] [422962] Sandbox: writing /proc/self/uid_map: EROFS
  - [pid=422924][err] [Parent 422924, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=422924][err]
  - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:58:38.214: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  - [pid=422924][err] [Parent 422924, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=422924][err]
  - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:58:38.215: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  - [pid=422924][err] [Parent 422924, Unnamed thread 7fcef3311160] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=422924][err]
  - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:58:38.215: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  2 × [pid=422924][err] [Parent 422924, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
    - [pid=422924][err]
    - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:58:38.216: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  - [pid=422924][err] [Parent 422924, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=422924][err]
  - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:59:44.273: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  - [pid=422924][err] [Parent 422924, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=422924][err]
  - [pid=422924][err] (firefox-default:422924): dconf-CRITICAL **: 15:59:44.274: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.

```