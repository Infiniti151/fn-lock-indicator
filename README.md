# Fn Lock Indicator
[![Build](https://img.shields.io/github/actions/workflow/status/Infiniti151/fn-lock-indicator/release.yml?branch=main&style=for-the-badge&logo=github-actions&logoColor=white&label=Build&color=%23007808)](https://github.com/Infiniti151/fn-lock-indicator/actions/workflows/release.yml) [![Latest Release](https://img.shields.io/github/v/release/Infiniti151/fn-lock-indicator?style=for-the-badge&logo=github&color=orange)](https://github.com/Infiniti151/fn-lock-indicator/releases) [![GNOME](https://img.shields.io/badge/GNOME-50-4A86E8?style=for-the-badge&logo=gnome&logoColor=white)](https://github.com/Infiniti151/fn-lock-indicator/blob/main/src/metadata.json) [![License](https://img.shields.io/github/license/Infiniti151/fn-lock-indicator?style=for-the-badge&logo=spdx&logoColor=white&color=yellow&label=License)](https://github.com/Infiniti151/fn-lock-indicator/blob/main/LICENSE)

A lightweight GNOME Shell extension that displays the current **Fn Lock state** directly in the GNOME status panel.

It is designed primarily for keyboards and laptops where the Fn Lock state is handled in software rather than exposed through a dedicated hardware Fn Lock key or standard keyboard indicator.

The extension uses **[keyd](https://github.com/rvaiya/keyd)** layer events to determine whether the Fn/media layer is active and reflects that state in the GNOME Shell panel.

>[!note]
> This extension does not track hardware Fn Lock.

## Demo

<video src="https://github.com/user-attachments/assets/b5b3732d-d911-4e0f-83ae-8f6d0ca6d5c0" controls="controls" style="max-width: 100%;">
</video>

## How It Works

Many laptop keyboards do not expose their Fn Lock state through a standard Linux input event.

For example, a laptop may use:

* `Fn + F1`–`F12` for hardware/media functions
* `Fn Lock` to switch the behavior of the function-row keys
* A firmware-specific implementation that is not visible to GNOME Shell

In these situations, a normal GNOME Shell extension cannot reliably determine whether Fn Lock is enabled by simply monitoring keyboard events.

This project instead relies on **keyd** to represent the Fn/media state as a software layer.

When the layer is toggled, keyd maintains the corresponding layer state. `fn-lock-indicator` monitors that state and uses it as the source of truth for the Fn Lock indicator.

In other words:

```text
Keyboard
   │
   ▼
  keyd
   │
   │ layer state / layer events
   ▼
fn-lock-indicator
   │
   ▼
GNOME Shell status panel
```

The extension therefore does **not** attempt to detect a physical Fn Lock state from the keyboard itself.

## Installing keyd

### Arch Linux

`keyd` is available directly from the official `extra` repository.

```bash
sudo pacman -S keyd
sudo systemctl enable --now keyd
```

Verify that the service is running:

```bash
systemctl status keyd
```

### Fedora

On Fedora, `keyd` can be installed through the `alternateved/keyd` COPR repository.

```bash
sudo dnf copr enable alternateved/keyd
sudo dnf install keyd
sudo systemctl enable --now keyd
```

Verify that the service is running:

```bash
systemctl status keyd
```

### Ubuntu

On newer Ubuntu releases, `keyd` may be available directly through `apt`:

```bash
sudo apt update
sudo apt install keyd
sudo systemctl enable --now keyd
```

If the package is unavailable for your Ubuntu release, keyd can be built from source:

```bash
sudo apt install build-essential git
git clone https://github.com/rvaiya/keyd.git
cd keyd
make
sudo make install
sudo systemctl enable --now keyd
```

Verify the service:

```bash
systemctl status keyd
```

## Configuring keyd

Once keyd is installed, configure your keyboard in:

```text
/etc/keyd/default.conf
```

The exact configuration depends on your keyboard and desired key mappings.

The important part for `fn-lock-indicator` is that the configuration provides a **toggleable keyd layer** representing the Fn/media-key state.

For example:

```ini
[ids]
*

[main]
# M4 toggles media layer
scrolldown = overload(media_layer, toggle(media_layer))

[media_layer]
# G14 Media Keys
f1 = mute
f2 = previoussong
f3 = playpause
f4 = nextsong
f5 = f15
f6 = A-sysrq
f7 = brightnessdown
f8 = brightnessup
f9 = M-p
f10 = f21
f11 = sleep
f12 = rfkill
```

After modifying the configuration, reload keyd:

```bash
sudo keyd reload
```

You can verify the daemon with:

```bash
systemctl status keyd
```

### Choosing a layer

The layer used by the extension should correspond to the layer representing your Fn/media-key state.

For example:

```ini
[media_layer]
...
```

If your configuration uses a different layer name, make sure the extension's configuration is adjusted accordingly.

## Installing fn-lock-indicator

### Option 1: Install from GitHub Release (Recommended)

Installing from a packaged release does not require developer tools or manual schema compilation.

1. Download the latest `.shell-extension.zip` file from the [Releases](https://github.com/Infiniti151/fn-lock-indicator/releases) page.
2. Install the extension using the GNOME Extensions CLI:
   ```bash
   gnome-extensions install --force fn-lock-indicator@infiniti151.github.io.shell-extension.zip
   ```
3. Reload your GNOME Session:

   X11: Press Alt + F2 to open the Run Command dialog, type r and then Enter to restart the Gnome Shell.

   Wayland: Logout using the GUI or with `gnome-session-quit --logout --no-prompt` in the terminal.

4. Enable the extension:
    ```bash
    gnome-extensions enable fn-lock-indicator@infiniti151.github.io
    ```

### Option 2: Install from Source
   
Clone the repository:

```bash
git clone https://github.com/Infiniti151/fn-lock-indicator.git
cd fn-lock-indicator
```

The project provides a small Makefile to simplify common operations.

| Command          | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `make install`   | Installs the extension and compiles its GSettings schema |
| `make enable`    | Enables the GNOME Shell extension                        |
| `make disable`   | Disables the GNOME Shell extension                       |
| `make uninstall` | Removes the installed extension                          |

A typical first-time setup is therefore:

1. Install
   ```bash
   make install
   ```

2. Reload your GNOME Session:

   X11: Press Alt + F2 to open the Run Command dialog, type r and then Enter to restart the Gnome Shell.

   Wayland: Logout using the GUI or with `gnome-session-quit --logout --no-prompt` in the terminal.

3. Enable
   ```bash
   make enable
   ```
## License

This project is distributed under the license included in [`LICENSE`](LICENSE).

See the `LICENSE` file for the complete license text and applicable terms.

