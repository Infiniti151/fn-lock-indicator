# Copyright (C) 2026 Infiniti151
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
# SPDX-License-Identifier: GPL-3.0-or-later

UUID = fn-lock-indicator@infiniti151.github.io
INSTALL_DIR = ~/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install enable disable uninstall

install:
	mkdir -p $(INSTALL_DIR)
	cp -r src/* $(INSTALL_DIR)/
	glib-compile-schemas $(INSTALL_DIR)/schemas/
	@echo "Extension installed to $(INSTALL_DIR)"

enable:
	gnome-extensions enable $(UUID)
	@echo "Extension $(UUID) enabled."

disable:
	gnome-extensions disable $(UUID)
	@echo "Extension $(UUID) disabled."

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Extension $(UUID) uninstalled."