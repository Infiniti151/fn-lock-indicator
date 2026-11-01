# SPDX-FileCopyrightText: 2026 Infiniti151
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