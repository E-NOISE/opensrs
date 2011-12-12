VOWS=./node_modules/vows/bin/vows
JSLINT=./node_modules/jslint/bin/jslint.js

.PHONY: all

all: build

build:
	@echo "Building project..."
	@${JSLINT} lib/opensrs.js

runtests:
	@${VOWS} test/test-opensrs.js --spec

clean:
	@rm -rf docs/
