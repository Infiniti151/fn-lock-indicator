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

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function getKeydLayers() {
    let layers = ['main'];
    const configDir = '/etc/keyd';

    try {
        const dir = Gio.File.new_for_path(configDir);
        const enumerator = dir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const fileName = info.get_name();

            if (fileName.endsWith('.conf')) {
                const child = dir.get_child(fileName);
                const [success, content] = child.load_contents(null);

                if (success) {
                    const fileString = new TextDecoder().decode(content);
                    const matches = fileString.matchAll(/^\[([^\]:]+)\]/gm);

                    for (const match of matches) {
                        const layerName = match[1].trim();
                        if (!layers.includes(layerName) && layerName !== 'ids') {
                            layers.push(layerName);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log("FnLock Prefs: Error scanning /etc/keyd/: " + e.message);
    }

    return layers.sort();
}

export default class FnLockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.fn-lock-indicator');
        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Settings',
        });
        page.add(group);

        const globalReset = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            valign: Gtk.Align.CENTER,
            has_frame: false,
            css_classes: ['flat'],
            tooltip_text: 'Reset all settings'
        });
        group.header_suffix = globalReset;

        const createRevertButton = (key, callback) => {
            const btn = new Gtk.Button({
                icon_name: 'edit-undo-symbolic',
                valign: Gtk.Align.CENTER,
                has_frame: false,
                css_classes: ['flat'],
                tooltip_text: `Reset to default`
            });
            btn.connect('clicked', () => {
                settings.reset(key);
                if (callback) callback();
            });
            return btn;
        };

        // --- 1. POSITION ROW ---
        const positionRow = new Adw.ComboRow({
            title: 'Position',
            subtitle: 'Indicator position in the panel',
            model: new Gtk.StringList({ strings: ['Left', 'Center', 'Right'] })
        });

        const positionSuffixBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            valign: Gtk.Align.CENTER,
            spacing: 6
        });

        const posResetBtn = createRevertButton('indicator-position');
        positionSuffixBox.append(posResetBtn);

        positionRow.add_suffix(positionSuffixBox);
        group.add(positionRow);

        const syncPosition = () => {
            const pos = settings.get_string('indicator-position');
            const map = { 'left': 0, 'center': 1, 'right': 2 };
            positionRow.selected = map[pos] ?? 0;
        };

        positionRow.connect('notify::selected', () => {
            const map = ['left', 'center', 'right'];
            settings.set_string('indicator-position', map[positionRow.selected]);
        });

        // --- 2. COLOR ROWS ---
        const colorOn = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog(),
            valign: Gtk.Align.CENTER
        });
        const rowOn = new Adw.ActionRow({
            title: 'On',
            subtitle: 'Indicator color for Fn lock on'
        });
        rowOn.add_suffix(colorOn);
        rowOn.add_suffix(createRevertButton('color-on'));

        const colorOff = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog(),
            valign: Gtk.Align.CENTER
        });
        const rowOff = new Adw.ActionRow({
            title: 'Off',
            subtitle: 'Indicator color for Fn lock off'
        });
        rowOff.add_suffix(colorOff);
        rowOff.add_suffix(createRevertButton('color-off'));

        const refreshPickers = () => {
            let rgbaOn = new Gdk.RGBA();
            if (rgbaOn.parse(settings.get_string('color-on'))) {
                colorOn.set_rgba(rgbaOn);
            }

            let rgbaOff = new Gdk.RGBA();
            if (rgbaOff.parse(settings.get_string('color-off'))) {
                colorOff.set_rgba(rgbaOff);
            }
        };

        group.add(rowOn);
        group.add(rowOff);

        // --- 3. TOAST TOGGLE ---
        const toastRow = new Adw.SwitchRow({
            title: 'Show Toast',
            subtitle: 'Display a popup on status change'
        });

        settings.bind('show-toast', toastRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        toastRow.add_suffix(createRevertButton('show-toast'));
        group.add(toastRow);

        // --- 4. OPACITY SLIDER ---
        const opacityRow = new Adw.ActionRow({
            title: 'Indicator Opacity',
            subtitle: 'Adjust how transparent the indicator appears'
        });

        const opacityScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 100, 1);
        opacityScale.set_draw_value(true);
        opacityScale.set_value_pos(Gtk.PositionType.RIGHT);
        opacityScale.set_size_request(200, -1);

        settings.bind('indicator-opacity', opacityScale.get_adjustment(), 'value', Gio.SettingsBindFlags.DEFAULT);

        opacityRow.add_suffix(opacityScale);
        opacityRow.add_suffix(createRevertButton('indicator-opacity'));
        group.add(opacityRow);

        // --- 5. INDICATOR ICON --- 
        const symbols = [
            { id: 'dot', char: '●' }, { id: 'status', char: '⇪' },
            { id: 'alt', char: '⎇' }, { id: 'fisheye', char: '◉' },
            { id: 'small_square', char: '▪' }, { id: 'diamond', char: '◆' },
            { id: 'toggle', char: '▣' }, { id: 'circuit', char: '⊚' },
            { id: 'power', char: '⌽' }, { id: 'command', char: '⌘' },
            { id: 'arrow', char: '⌤' }, { id: 'dot_matrix', char: '⠿' },
            { id: 'shield', char: '⛨' }, { id: 'hollow_box', char: '□' },
            { id: 'lines', char: '▤' }, { id: 'lock', char: '🔒' }
        ];

        const styleRow = new Adw.ActionRow({
            title: 'Indicator Icon',
            subtitle: 'Click the symbol to change the indicator style'
        });

        const pickerBtn = new Gtk.MenuButton({
            valign: Gtk.Align.CENTER,
            css_classes: ['square']
        });

        const popover = new Gtk.Popover();
        const flowBox = new Gtk.FlowBox({
            max_children_per_line: 4,
            min_children_per_line: 4,
            selection_mode: Gtk.SelectionMode.NONE,
            margin_top: 6, margin_bottom: 6, margin_start: 6, margin_end: 6
        });

        symbols.forEach(item => {
            const btn = new Gtk.Button({
                label: item.char,
                css_classes: ['flat'],
                width_request: 40,
                height_request: 40,
                tooltip_text: item.id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            });

            btn.connect('clicked', () => {
                settings.set_string('indicator-style', item.id);
                popover.popdown();
            });

            flowBox.append(btn);
        });

        popover.set_child(flowBox);
        pickerBtn.set_popover(popover);

        const updatePickerLabel = () => {
            const current = settings.get_string('indicator-style');
            const match = symbols.find(s => s.id === current);
            pickerBtn.label = match ? match.char : '●';
        };

        settings.connect('changed::indicator-style', updatePickerLabel);
        updatePickerLabel();

        styleRow.add_suffix(pickerBtn);
        styleRow.add_suffix(createRevertButton('indicator-style'));
        group.add(styleRow);

        // --- 6. LAYER NAME ROW ---
        const layers = getKeydLayers();

        const layerRow = new Adw.ComboRow({
            title: 'Keyd Layer Name',
            subtitle: 'The layer to monitor for the indicator',
            model: new Gtk.StringList({
                strings: layers
            })
        });

        const currentLayer = settings.get_string('layer-name');
        const initialIndex = layers.indexOf(currentLayer);
        layerRow.selected = initialIndex !== -1 ? initialIndex : 0;

        layerRow.connect('notify::selected', () => {
            const selectedLayer = layers[layerRow.selected];
            settings.set_string('layer-name', selectedLayer);
        });

        const syncLayerRow = () => {
            const current = settings.get_string('layer-name');
            const index = layers.indexOf(current);
            layerRow.selected = index !== -1 ? index : 0;
        };

        layerRow.add_suffix(createRevertButton('layer-name', syncLayerRow));
        group.add(layerRow);

        // --- 7. HIDE ON DISABLE TOGGLE ---
        const hideRow = new Adw.SwitchRow({
            title: 'Hide When Off',
            subtitle: 'Completely remove the indicator from the panel when Fn-Lock is disabled'
        });

        hideRow.bind_property(
            'active',
            rowOff,
            'sensitive',
            GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.INVERT_BOOLEAN
        );

        settings.bind('hide-on-disable', hideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        hideRow.add_suffix(createRevertButton('hide-on-disable'));
        group.add(hideRow);

        // --- 8. LEFT CLICK ACTION ---
        const leftClickExpander = new Adw.ExpanderRow({
            title: 'Left-Click Toggle',
            subtitle: 'Run a command when the indicator is left-clicked',
            show_enable_switch: false,
        });

        const toggleSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END
        });

        const suffixBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            valign: Gtk.Align.CENTER,
            spacing: 12
        });

        settings.bind('left-click-toggle', toggleSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        toggleSwitch.bind_property('active', leftClickExpander, 'enable-expansion', GObject.BindingFlags.SYNC_CREATE);

        suffixBox.append(toggleSwitch);
        suffixBox.append(createRevertButton('left-click-toggle'));

        leftClickExpander.add_suffix(suffixBox);

        const commandEntry = new Adw.EntryRow({
            title: 'Toggle Command',
        });

        settings.bind('left-click-command', commandEntry, 'text', Gio.SettingsBindFlags.DEFAULT);

        leftClickExpander.add_row(commandEntry);
        group.add(leftClickExpander);

        // --- GLOBAL SYNC ---
        refreshPickers();
        syncPosition();

        settings.connect('changed::indicator-position', () => syncPosition());
        settings.connect('changed::color-on', () => refreshPickers());
        settings.connect('changed::color-off', () => refreshPickers());
        settings.connect('changed::layer-name', syncLayerRow);

        globalReset.connect('clicked', () => {
            settings.reset('color-on');
            settings.reset('color-off');
            settings.reset('indicator-position');
            settings.reset('show-toast');
            settings.reset('indicator-opacity');
            settings.reset('indicator-style');
            settings.reset('layer-name');
            settings.reset('hide-on-disable');
            settings.reset('left-click-toggle');
        });

        colorOn.connect('notify::rgba', () => {
            settings.set_string('color-on', colorOn.get_rgba().to_string());
        });

        colorOff.connect('notify::rgba', () => {
            settings.set_string('color-off', colorOff.get_rgba().to_string());
        });
    }
}