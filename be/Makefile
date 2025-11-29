PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
SRC_DIR := src
BIN := be
SRC := $(SRC_DIR)/be.go
SYSTEMD_DIR := /etc/systemd/system

all: $(BIN)

$(BIN): $(SRC)
	cd $(SRC_DIR) && go build -o ../$(BIN)

install: $(BIN)
	sudo install -d $(BINDIR)
	sudo install -m 755 $(BIN) $(BINDIR)/$(BIN)
	sudo install -m 644 etc/systemd/system/be.service $(SYSTEMD_DIR)/be.service
	sudo install -m 644 etc/be.conf /etc/be.conf
	sudo systemctl daemon-reload
	sudo systemctl enable be.service
	sudo systemctl start be.service

uninstall:
	@if [ -f $(SYSTEMD_DIR)/be.service ]; then \
		sudo systemctl stop be.service; \
		sudo systemctl disable be.service; \
		sudo rm -f $(SYSTEMD_DIR)/be.service; \
		sudo rm -f /etc/be.conf; \
		sudo systemctl daemon-reload; \
	fi

clean:
	rm -f $(BIN)

.PHONY: all install uninstall clean
