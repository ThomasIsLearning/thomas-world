# Thomas' World

A kitchen-screen build of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)
(Bilawal Sidhu, MIT) for the Raspberry Pi 5 Home Node: a photorealistic
globe with live aircraft, ships, satellites, MBTA vehicles, public cameras,
traffic flow and weather (rain radar, satellite clouds, lightning, wind), all
from public feeds, running locally on the Pi and opened from a tile in
[Home Base](https://github.com/ThomasIsLearning/Pi5-Home-Node).

This fork tracks upstream; everything specific to the Pi lives in this
folder so upstream pulls stay clean.

```
upstream gods-eye-view ──fork──► ThomasIsLearning/thomas-world
                                   └── thomas-world/   install.sh, systemd unit, kiosk notes
Pi 5:  docker compose (bound to 127.0.0.1:4173)  ◄── kiosk Chromium tab opened by Home Base
```

## Install on the Pi

```bash
git clone https://github.com/ThomasIsLearning/thomas-world.git ~/thomas-world
cd ~/thomas-world && ./thomas-world/install.sh
```

The script installs Docker if it is missing (official convenience script),
builds the image (10–20 minutes the first time on a Pi 5), starts it, and
installs a systemd unit so it comes back after a reboot. Everything the app
saves (`.env` keys, `.gev-cache/`, `.gev-logs/`) stays in `~/thomas-world`.

## Keys

The app works with no keys at all. Optional upgrades, entered once:

- **TomTom** (traffic flow): put `TOMTOM_API_KEY=...` in `~/thomas-world/.env`
  (owner-only file). Stays inside TomTom's free tier thanks to the app's
  daily tile budget.
- **Cesium ion** (photorealistic 3D tiles + terrain, free personal tier):
  `CESIUM_ION_TOKEN=...` in the same file. Heavier on the Pi; try without first.

The in-app Provider Settings panel (POWER UP chip) only answers requests from
the Pi itself, which is where the kiosk browser runs, so it works from the
touchscreen too.

## The kitchen preset

Open the tile, pan to Greater Boston, turn on the layers you want (Movement →
Aircraft, Transit; Cameras; Weather → Rain radar), pick a style. The app
keeps its last view and layers, so that becomes the preset. To pin a
specific view, copy the share link from the app and set it as the tile URL in
`/etc/homenode/shell.json`.

## Everyday

```bash
thomas-world status      # container state + last log lines
thomas-world logs        # follow logs
thomas-world update      # git pull (upstream merged), rebuild, restart
thomas-world restart
```

## Pi 5 notes

The Pi 5's GPU handles the globe at the screen's 1024×600, but it is the
heaviest thing the Home Node draws. If it stutters: keep terrain off, prefer
the plain satellite imagery over Cesium ion 3D tiles, and turn on only the
layers you look at. The Home Base idle timer still closes the tab after ten
quiet minutes so it is not rendering all night.


## Lite mode and the start view

The kitchen Pi opens Thomas' World with

    http://127.0.0.1:4173/?lite=1#lat=42.5065&lon=-71.0723&alt=9000&heading=0&pitch=-45&map=photoreal

`?lite=1` turns off MSAA, caps the frame rate at 30 and renders at 0.75 scale
(see `LITE_MODE` in `src/app/viewer.js`). The `#lat=...` hash is the app's own
long share form, so the globe always starts over Wakefield, MA no matter where
it was left. Change the numbers or paste any share link's hash to change the
start view; layers stay whatever was last switched on.
