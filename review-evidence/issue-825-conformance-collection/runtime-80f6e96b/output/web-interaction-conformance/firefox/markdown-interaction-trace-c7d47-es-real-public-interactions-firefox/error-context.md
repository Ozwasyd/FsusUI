# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: markdown-interaction-trace.spec.ts >> mounts representative Vue components and traces real public interactions
- Location: vue/tests/markdown-editor/markdown-interaction-trace.spec.ts:271:5

# Error details

```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
Call log:
  - <launching> /workspace/.setup/ms-playwright/firefox-1511/firefox/firefox -no-remote -headless -profile /tmp/playwright_firefoxdev_profile-PC5qhm -juggler-pipe -silent
  - <launched> pid=421279
  - [pid=421279][err] *** You are running in headless mode.
  30 × [pid=421279][err] Fontconfig error: No writable cache directories
  - [pid=421279][err] [421317] Sandbox: writing /proc/self/uid_map: EROFS
  4 × [pid=421279][err] [Parent 421279, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
    - [pid=421279][err]
    - [pid=421279][err] (firefox-default:421279): dconf-CRITICAL **: 15:55:36.205: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  - [pid=421279][err] [Parent 421279, Unnamed thread 7f8b531fb160] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
  - [pid=421279][err]
  - [pid=421279][err] (firefox-default:421279): dconf-CRITICAL **: 15:55:36.205: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.
  2 × [pid=421279][err] [Parent 421279, Main Thread] WARNING: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.: 'glib warning', file /home/pwuser/firefox/toolkit/xre/nsSigHandlers.cpp:201
    - [pid=421279][err]
    - [pid=421279][err] (firefox-default:421279): dconf-CRITICAL **: 15:56:42.275: unable to create directory '/home/agent/.cache/dconf': Read-only file system.  dconf will not work properly.

```