/*
 * Copyright (C) 2026 Infiniti151
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const LOG_PREFIX = '[FnLock]';

const Log = {
    info: (msg) => console.log(`${LOG_PREFIX} INFO: ${msg}`),
    warn: (msg) => console.warn(`${LOG_PREFIX} WARN: ${msg}`),
    error: (msg) => console.error(`${LOG_PREFIX} ERROR: ${msg}`)
};

const decoder = new TextDecoder('utf-8');

export default class FnLockExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.fn-lock-indicator');
        this._lastState = null;
        this._isLocked = false;
        this._lastToggleTime = 0;
        this._reconnectTimeoutId = 0;

        this._posId = this._settings.connect('changed::indicator-position', () => this._updatePosition());
        this._leftClickToggleId = this._settings.connect('changed::left-click-toggle', () => this._updatePosition());
        this._leftClickCommandId = this._settings.connect('changed::left-click-command', () => this._updatePosition());
        this._colorOnId = this._settings.connect('changed::color-on', () => this._updateUI());
        this._colorOffId = this._settings.connect('changed::color-off', () => this._updateUI());
        this._opacityId = this._settings.connect('changed::indicator-opacity', () => this._updateUI());
        this._toastId = this._settings.connect('changed::show-toast', () => this._updateUI());
        this._styleId = this._settings.connect('changed::indicator-style', () => this._updateUI());
        this._layerName = this._settings.get_string('layer-name') || 'media_layer';
        this._layerNameId = this._settings.connect('changed::layer-name', () => {
            this._layerName = this._settings.get_string('layer-name');
            this._cleanupProcess();
            this._connectToKeydSocket();
        });
        this._hideOnDisableId = this._settings.connect('changed::hide-on-disable', () => this._updateUI());

        this._updatePosition();
        this._connectToKeydSocket();

        Log.info('Fn Lock Indicator enabled ✅');
    }

    _syncInitialState() {
        this._isLocked = false;
        this._updateUI();
    }

    _connectToKeydSocket() {
        this._cleanupProcess();

        this._isLocked = false;
        this._lastState = false;
        this._updateUI();

        try {
            const shPath = '/usr/bin/sh';
            const shellCommand = `keyd listen | grep --line-buffered "${this._layerName}"`;

            this._keydProcess = new Gio.Subprocess({
                argv: [shPath, '-c', shellCommand],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            });

            this._keydProcess.init(null);

            const stdout = this._keydProcess.get_stdout_pipe();
            const dataStream = new Gio.DataInputStream({ base_stream: stdout });

            this._readErrorStream(this._keydProcess.get_stderr_pipe());
            this._readSocketLine(dataStream);
        } catch (e) {
            Log.error(`Socket connection failed: ${e.message}`);
            this._scheduleReconnect();
        }
    }

    _scheduleReconnect() {
        if (this._reconnectTimeoutId) return;

        this._isLocked = false;
        this._lastState = false;
        this._updateUI();

        this._reconnectTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._reconnectTimeoutId = 0;
            Log.info('Attempting to reconnect to keyd stream...');
            this._connectToKeydSocket();
            return GLib.SOURCE_REMOVE;
        });
    }

    _readSocketLine(stream) {
        stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (source, res) => {
            try {
                const [line] = source.read_line_finish(res);
                if (line !== null) {
                    const output = decoder.decode(line).trim();
                    if (output.includes(this._layerName)) {
                        const newState = output.startsWith('+');

                        // Set state directly based on keyd '+' (layer active) or '-' (layer inactive)
                        this._isLocked = newState;
                        this._updateUI();
                        Log.info(`Fn-Lock is now ${this._isLocked ? 'ON' : 'OFF'}`);
                    }
                    this._readSocketLine(source);
                } else {
                    Log.warn("Keyd stream dropped (service restarted or reloaded). Resetting state...");
                    this._cleanupProcess();
                    this._scheduleReconnect();
                }
            } catch (e) {
                Log.error(`Stream read error: ${e.message}`);
                this._cleanupProcess();
                this._scheduleReconnect();
            }
        });
    }

    _cleanupProcess() {
        if (this._keydProcess) {
            try {
                this._keydProcess.force_exit();
            } catch (e) {
                Log.error(`Cleanup failed: ${e.message}`);
            }
            this._keydProcess = null;
        }
    }

    _readErrorStream(stream) {
        const errorReader = new Gio.DataInputStream({ base_stream: stream });
        errorReader.read_line_async(GLib.PRIORITY_DEFAULT, null, (source, res) => {
            try {
                const [line] = source.read_line_finish(res);
                if (line !== null) {
                    Log.error(`${decoder.decode(line)}`);
                    this._readErrorStream(stream);
                }
            } catch (e) {
                Log.error(`Failed to read stream: ${e.message}`);
            }
        });
    }

    _updatePosition() {
        const newPos = this._settings.get_string('indicator-position') || 'left';

        if (this._indicator && this._indicator._currentPos !== newPos) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (!this._indicator) {
            try {
                this._indicator = new PanelMenu.Button(0.0, 'FnLockIndicator', false);

                this._indicator.set_reactive(true);
                this._indicator._currentPos = newPos;

                this._indicator.clear_actions();

                this._indicator.connect('captured-event', (actor, event) => {
                    if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                        return this._handleClicks(actor, event);
                    }
                    return Clutter.EVENT_PROPAGATE;
                });

                this._label = new St.Label({
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'margin-left: 6px; margin-right: -4px; font-weight: bold; font-size: 14px;'
                });
                this._indicator.add_child(this._label);

                Main.panel.addToStatusArea('fn-lock-indicator', this._indicator, 0, newPos);
            } catch (e) {
                Log.error(`Failed to create indicator: ${e.message}`);
            }
        }

        this._updateUI();
    }

    _handleClicks(actor, event) {
        const button = event.get_button();

        if (button === 1) {
            const isToggleEnabled = this._settings.get_boolean('left-click-toggle');
            const customCommand = this._settings.get_string('left-click-command');

            if (isToggleEnabled && customCommand) {
                try {
                    GLib.spawn_command_line_async(customCommand);

                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                        this._updateUI();
                        return GLib.SOURCE_REMOVE;
                    });
                    return Clutter.EVENT_STOP;
                } catch (e) {
                    Log.error(`Execution failed: ${e.message}`);
                }
            } else {
                Log.warn('Left-click ignored: Toggle disabled or command empty.');
            }
        }

        else if (button === 3) {
            try {
                Main.extensionManager.openExtensionPrefs(this.metadata.uuid, '', {});
                return Clutter.EVENT_STOP;
            } catch (e) {
                Log.error(`Could not open prefs: ${e.message}`);
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _updateUI() {
        if (!this._label || !this._settings) return;
        const isLocked = !!this._isLocked;
        const hideOnDisable = this._settings.get_boolean('hide-on-disable');

        if (hideOnDisable) {
            if (isLocked) {
                this._indicator.show();
            } else {
                this._indicator.hide();
            }
        } else {
            this._indicator.show();
        }

        try {
            const opacityInt = this._settings.get_int('indicator-opacity');
            this._label.set_opacity(Math.floor((opacityInt / 100) * 255));

            const style = this._settings.get_string('indicator-style');
            const charMap = {
                'dot': '●',
                'status': '⇪',
                'alt': '⎇',
                'fisheye': '◉',
                'small_square': '▪',
                'diamond': '◆',
                'toggle': '▣',
                'circuit': '⊚',
                'power': '⌽',
                'command': '⌘',
                'arrow': '⌤',
                'dot_matrix': '⠿',
                'shield': '⛨',
                'hollow_box': '□',
                'lines': '▤',
                'lock': '🔒'
            };
            this._label.set_text((style === 'lock' && !isLocked) ? '🔓' : (charMap[style] || '●'));

            const colorKey = isLocked ? 'color-on' : 'color-off';
            const targetColor = this._settings.get_string(colorKey);
            this._label.set_style(`color: ${targetColor} !important; font-weight: bold; font-size: 14px;`);

            if (this._lastState !== this._isLocked) {
                const showToast = this._settings.get_boolean('show-toast');
                if (showToast) {
                    const message = isLocked ? 'Fn-Lock: Enabled' : 'Fn-Lock: Disabled';
                    const iconName = isLocked ? 'changes-prevent-symbolic' : 'changes-allow-symbolic';
                    const gicon = Gio.Icon.new_for_string(iconName);
                    const monitorIndex = Main.layoutManager.primaryIndex;

                    Main.osdWindowManager.showOne(monitorIndex, gicon, message, null, null);
                }
                this._lastState = this._isLocked;
            }
        } catch (e) {
            Log.error(`${e.message}`);
            this._label.set_text('☢️');
        }
    }

    disable() {
        if (this._reconnectTimeoutId) {
            GLib.source_remove(this._reconnectTimeoutId);
            this._reconnectTimeoutId = 0;
        }

        this._cleanupProcess();

        this._settings?.disconnect(this._posId);
        this._settings?.disconnect(this._leftClickToggleId);
        this._settings?.disconnect(this._leftClickCommandId);
        this._settings?.disconnect(this._colorOnId);
        this._settings?.disconnect(this._colorOffId);
        this._settings?.disconnect(this._opacityId);
        this._settings?.disconnect(this._toastId);
        this._settings?.disconnect(this._styleId);
        this._settings?.disconnect(this._layerNameId);
        this._settings?.disconnect(this._hideOnDisableId);

        if (this._indicator) {
            this._indicator.destroy();
        }

        this._indicator = this._settings = this._label = this._isLocked = null;

        Log.info('Fn Lock Indicator disabled ❌');
    }
}
