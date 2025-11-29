PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
SRC_DIR := src
BIN := base
SRC := $(SRC_DIR)/base.go
SYSTEMD_DIR := /etc/systemd/system
GROUP := rfm70

all: $(BIN)

$(BIN): $(SRC)
	cd $(SRC_DIR) && GOOS=linux GOARCH=arm64 CGO_ENABLED=1 go build -o ../$(BIN)

install: $(BIN)
	sudo install -d $(BINDIR)
	sudo install -m 755 $(BIN) $(BINDIR)/$(BIN)
	sudo install -m 644 etc/udev/rules.d/99-base.rules /etc/udev/rules.d/99-base.rules
	sudo install -m 644 etc/systemd/system/base.service $(SYSTEMD_DIR)/base.service
	sudo install -m 644 etc/base.conf /etc/base.conf
	@if ! getent group $(GROUP) > /dev/null; then \
		echo "Creating system group mydevice"; \
		sudo groupadd --system $(GROUP); \
	fi
	sudo udevadm control --reload-rules
	sudo udevadm trigger
	sudo systemctl daemon-reload
	sudo systemctl enable base.service
	sudo systemctl start base.service

uninstall:
	@if [ -f $(SYSTEMD_DIR)/base.service ]; then \
		sudo systemctl stop base.service; \
		sudo systemctl disable base.service; \
		sudo rm -f $(SYSTEMD_DIR)/base.service; \
		sudo rm -f /etc/base.conf; \
		sudo systemctl daemon-reload; \
	fi
	@if [ -f /etc/udev/rules.d/99-base.rules ]; then \
		sudo rm -f /etc/udev/rules.d/99-base.rules; \
		sudo udevadm control --reload-rules; \
		sudo udevadm trigger; \
	fi
	@if getent group $(GROUP) > /dev/null; then \
		sudo groupdel $(GROUP); \
	fi
clean:
	rm -f $(BIN)

.PHONY: all install uninstall clean
