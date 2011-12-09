VOWS=./node_modules/vows/bin/vows

.PHONY: all

all: build

build:
	@echo "Building project..."

runtests:
	@${VOWS} test/test-opensrs.js --spec

clean:
	@rm -rf docs/
