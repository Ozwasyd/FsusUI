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

if ! pgrep -u "$(id -u)" -f "ibus-daemon" >/dev/null 2>&1 || ! ibus engine >/dev/null 2>&1; then
  ibus-daemon -drx --panel=disable --config=/usr/libexec/ibus-memconf
  sleep 1.2
fi

mkdir -p "$XDG_CONFIG_HOME/mozc"
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
export NO_AT_BRIDGE=0
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}
export FSUS_IME_DISPLAY=$DISPLAY_NAME
export FSUS_IME_EXTRA_ENV='{"DBUS_SESSION_BUS_ADDRESS":"unix:path=$RUNTIME/bus","XDG_RUNTIME_DIR":"$RUNTIME/xdg","XDG_CONFIG_HOME":"$RUNTIME/config","GTK_IM_MODULE":"ibus","QT_IM_MODULE":"ibus","XMODIFIERS":"@im=ibus"}'
EOF

echo "session-ready runtime=$RUNTIME display=$DISPLAY_NAME engine=$(ibus engine 2>/dev/null || echo none)"
echo "source $RUNTIME/env"
