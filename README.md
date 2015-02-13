# node-opensrs

[![NPM](https://nodei.co/npm/opensrs.png?compact=true)](https://nodei.co/npm/opensrs/)

[![Build Status](https://travis-ci.org/E-NOISE/opensrs.svg?branch=master)](https://travis-ci.org/E-NOISE/opensrs)
[![Dependency Status](https://david-dm.org/E-NOISE/opensrs.svg?style=flat)](https://david-dm.org/E-NOISE/opensrs)
[![devDependency Status](https://david-dm.org/wrangr/opensrs/dev-status.png)](https://david-dm.org/wrangr/opensrs#info=devDependencies)

Node.js client for the [OpenSRS Reseller XML API](http://www.opensrs.com/docs/opensrs_xmlapi.pdf).

## Installation

```sh
npm install --save opensrs
```

## Usage

```js
var opensrs = require('opensrs');

// Get client
var client = opensrs({
  user: '<YOUR-OPENSRS-RESELLER-USERNAME>',
  key: '<YOUR-OPENSRS-RESELLER-API-KEY>',
  sandbox: true
});

// Issue request with client
client('balance', 'get_balance', function (err, data) {
  //...
});

client('domain', 'lookup', { domain: 'foo.com' }, function (err, data) {
  //...
});
```

## API

### `client( object, action, params, callback )`

## License

The MIT License (MIT)

Copyright (c) 2015 Lupo Montero &lt;lupo@enoi.se&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

