#!/usr/bin/env bash
# Isolated X11 + ibus + AT-SPI session for native IME / Orca acceptance.
set -euo pipefail

RUNTIME="${FSUS_IME_RUNTIME:-/tmp/fsus-ime-session}"
DISPLAY_NAME="${FSUS_IME_DISPLAY:-:21}"
mkdir -p "$RUNTIME/xdg" "$RUNTIME/config" "$RUNTIME/cache"
chmod 700 "$RUNTIME" "$RUNTIME/xdg"

export DISPLAY="$DISPLAY_NAME"
export XDG_RUNTIME_DIR="$RUNTIME/xdg"
export XDG_CONFIG_HOME="$RUNTIME/config"
export XDG_CACHE_HOME="$RUNTIME/cache"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$RUNTIME/bus"
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus
export IBUS_USE_PORTAL=0
export IBUS_ENABLE_SYNC_MODE=1
export NO_AT_BRIDGE=0
export GTK_MODULES="${GTK_MODULES:+$GTK_MODULES:}gail:atk-bridge"

if [[ ! -S "$RUNTIME/bus" ]]; then
  dbus-daemon --session --address="$DBUS_SESSION_BUS_ADDRESS" --fork --print-pid >"$RUNTIME/dbus.pid"
  sleep 0.2
fi

if ! xdpyinfo -display "$DISPLAY_NAME" >/dev/null 2>&1; then
  Xvfb "$DISPLAY_NAME" -screen 0 1920x1080x24 -ac +extension GLX +render -noreset >/tmp/fsus-ime-xvfb.log 2>&1 &
  echo $! >"$RUNTIME/xvfb.pid"
  for _ in $(seq 1 50); do
    xdpyinfo -display "$DISPLAY_NAME" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi

if ! xdpyinfo -display "$DISPLAY_NAME" >/dev/null 2>&1; then
  echo "failed to start Xvfb on $DISPLAY_NAME" >&2
  exit 1
fi

if [[ ! -f "$RUNTIME/openbox.pid" ]] || ! kill -0 "$(cat "$RUNTIME/openbox.pid")" 2>/dev/null; then
  openbox --sm-disable >/tmp/fsus-ime-openbox.log 2>&1 &
  echo $! >"$RUNTIME/openbox.pid"
  sleep 0.3
fi

if [[ ! -f "$RUNTIME/atspi.pid" ]] || ! kill -0 "$(cat "$RUNTIME/atspi.pid")" 2>/dev/null; then
  if [[ -x /usr/libexec/at-spi-bus-launcher ]]; then
    /usr/libexec/at-spi-bus-launcher --launch-immediately >/tmp/fsus-ime-atspi.log 2>&1 &
    echo $! >"$RUNTIME/atspi.pid"
    sleep 0.4
  fi
fi

# Bind ibus to THIS session's DISPLAY/DBUS. A leftover daemon on another
# display must not skip startup here.
if ! ibus engine >/dev/null 2>&1; then
  ibus-daemon -drx --panel=disable --config=/usr/libexec/ibus-memconf
  sleep 1.2
fi
# Isolated sessions often write ibus/bus/-unix-N instead of $HOSTNAME-unix-N.
# Firefox only looks up the hostname-named file unless IBUS_ADDRESS is set.
IBUS_ADDRESS="$(ibus address 2>/dev/null || true)"
export IBUS_ADDRESS
host_name="$(hostname 2>/dev/null || true)"
bus_dir="$XDG_CONFIG_HOME/ibus/bus"
if [[ -n "$host_name" && -d "$bus_dir" ]]; then
  for bus_file in "$bus_dir"/*; do
    [[ -f "$bus_file" ]] || continue
    cp -f "$bus_file" "$bus_dir/${host_name}-unix-${DISPLAY_NAME#:}" >/dev/null 2>&1 || true
  done
fi

# Hangul's packaged default is latin/English mode, which commits ASCII.
if command -v gsettings >/dev/null 2>&1; then
  gsettings set org.freedesktop.ibus.engine.hangul initial-input-mode hangul >/dev/null 2>&1 || true
  gsettings set org.freedesktop.ibus.engine.hangul disable-latin-mode true >/dev/null 2>&1 || true
  # Syllable mode commits a jamo on Escape. Word preedit keeps composition
  # open until Space (commit) or Escape (cancel).
  gsettings set org.freedesktop.ibus.engine.hangul preedit-mode word >/dev/null 2>&1 || true
  gsettings set org.freedesktop.ibus.engine.hangul off-keys "''" >/dev/null 2>&1 || true
fi
pkill -f ibus-engine-hangul >/dev/null 2>&1 || true
# 2-set hangul expects Latin keysyms from a US map, not kr104.
setxkbmap -layout us >/dev/null 2>&1 || true

mkdir -p "$XDG_CONFIG_HOME/gtk-3.0" "$XDG_CONFIG_HOME/mozc"
cat >"$XDG_CONFIG_HOME/gtk-3.0/settings.ini" <<'EOF'
[Settings]
gtk-im-module=ibus
EOF
if command -v gsettings >/dev/null 2>&1; then
  gsettings set org.gnome.desktop.interface gtk-im-module ibus >/dev/null 2>&1 || true
fi
cat >"$XDG_CONFIG_HOME/mozc/ibus_config.textproto" <<'EOF'
engines {
  name : "mozc-jp"
  longname : "Mozc"
  layout : "default"
  layout_variant : ""
  layout_option : ""
  rank : 80
}
active_on_launch: True
EOF
# Provide Japanese / Hangul mode keys on a US XKB map.
xmodmap -e 'keycode 248 = Zenkaku_Hankaku' >/dev/null 2>&1 || true
xmodmap -e 'keycode 209 = Hangul' >/dev/null 2>&1 || true

ibus engine libpinyin >/dev/null 2>&1 || true

cat >"$RUNTIME/env" <<EOF
export DISPLAY=$DISPLAY_NAME
export DBUS_SESSION_BUS_ADDRESS=unix:path=$RUNTIME/bus
export XDG_RUNTIME_DIR=$RUNTIME/xdg
export XDG_CONFIG_HOME=$RUNTIME/config
export XDG_CACHE_HOME=$RUNTIME/cache
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus
export XMODIFIERS=@im=ibus
export IBUS_USE_PORTAL=0
export IBUS_ENABLE_SYNC_MODE=1
export IBUS_ADDRESS=$IBUS_ADDRESS
export NO_AT_BRIDGE=0
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}
export FSUS_IME_DISPLAY=$DISPLAY_NAME
export FSUS_IME_EXTRA_ENV='{"DBUS_SESSION_BUS_ADDRESS":"unix:path=$RUNTIME/bus","XDG_RUNTIME_DIR":"$RUNTIME/xdg","XDG_CONFIG_HOME":"$RUNTIME/config","XDG_CACHE_HOME":"$RUNTIME/cache","GTK_IM_MODULE":"ibus","QT_IM_MODULE":"ibus","XMODIFIERS":"@im=ibus","IBUS_USE_PORTAL":"0","IBUS_ENABLE_SYNC_MODE":"1","IBUS_ADDRESS":"$IBUS_ADDRESS"}'
EOF

echo "session-ready runtime=$RUNTIME display=$DISPLAY_NAME engine=$(ibus engine 2>/dev/null || echo none)"
echo "source $RUNTIME/env"
