# Avalonia Preview Platform Matrix

## Required CI Coverage

| Platform | Required For Preview | Notes                                      |
| -------- | -------------------- | ------------------------------------------ |
| Linux    | yes                  | Restore, build, unit/headless test, pack   |
| Windows  | yes                  | Restore, build, unit/headless test, pack   |
| macOS    | later expansion      | Add when release owner requires validation |

Linux desktop validation must avoid assuming a graphical desktop unless the
specific test uses Avalonia headless or an explicit X11/Wayland setup.
