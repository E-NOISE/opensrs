'use strict';


//
// Dependencies
//
const Tls = require('tls');
const Util = require('util');
const Crypto = require('crypto');
const Xml = require('node-xml');


const eol = '\r\n';
const rpc_handler_version = '0.9';
const rpc_handler_port = 55443;


const defaults = {
  user: null,
  key: null,
  sandbox: false
};


const isObject = (obj) => {

  const type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
};


const extend = (obj, ...args) => {

  if (!isObject(obj)) {
    return obj;
  }

  const hasOwnProperty = Object.prototype.hasOwnProperty;
  let source;

  for (let i = 0; i < args.length; ++i) {
    source = args[i];
    for (const prop in source) {
      if (hasOwnProperty.call(source, prop)) {
        obj[prop] = source[prop];
      }
    }
  }

  return obj;
};


const isNonEmptyObj = (o) => {

  let k;
  let count = 0;

  if (typeof o !== 'object') {
    return false;
  }

  for (k in o) {
    if (o.hasOwnProperty(k)) {
      count++;
    }
  }

  return (count > 0);
};


const buildDataBlock = (data) => {

  let key;
  let str = '';
  const tag = (Util.isArray(data)) ? 'dt_array' : 'dt_assoc';

  str += '<' + tag + '>' + eol;

  for (key in data) {
    if (data.hasOwnProperty(key)) {
      if (Util.isArray(data[key]) || isNonEmptyObj(data[key])) {
        str += '<item key="' + key + '">' + eol;
        str += buildDataBlock(data[key]);
        str += '</item>' + eol;
      }
      else if (data[key]) {
        str += '<item key="' + key + '">' + data[key] + '</item>' + eol;
      }
    }
  }

  str += '</' + tag + '>' + eol;
  return str;
};


const buildXmlPayload = (obj, action, attr) => {

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<!DOCTYPE OPS_envelope SYSTEM "ops.dtd">',
    '<OPS_envelope>',
    '<header>',
    '<version>' + rpc_handler_version + '</version>',
    '</header>',
    '<body>',
    '<data_block>',
    buildDataBlock({
      protocol: 'XCP',
      object: obj,
      action,
      attributes: attr
    }),
    '</data_block>',
    '</body>',
    '</OPS_envelope>'
  ].join(eol);
};


const signRequest = (xml, key) => {

  let hash = Crypto.createHash('md5');
  hash.update(xml + key);
  const tmp = hash.digest('hex');
  hash = Crypto.createHash('md5');
  hash.update(tmp + key);
  return hash.digest('hex');
};


const buildRequest = (host, user, key, xml) => {

  return [
    'POST ' + host + ' HTTP/1.0',
    'Content-Type: text/xml',
    'X-Username: ' + user,
    'X-Signature: ' + signRequest(xml, key),
    'Content-Length: ' + xml.length,
    eol + xml
  ].join(eol);
};


//
// ### Parse XML response asynchronously
//
// #### Arguments
//
// * _String_ **responseXml** The XML string to be parsed.
// * _Function_ **cb** Callback invoked when parsing is finshed.
//   This function will have two arguments: an error object and the
//   parsed data. If successful the error object will be null.
//
const parseResponse = (responseXml, cb) => {

  const parser = new Xml.SaxParser((p) => {

    let res;
    let parent;
    let currentKey;
    let oldKey;
    let currentKeyStringParts;

    p.onEndDocument(() => {

      cb(null, res);
    });

    p.onStartElementNS((elem, attrs) => {

      switch (elem) {
      case 'dt_assoc':
        if (!res) {
          res = {};
        }
        else {
          res[currentKey] = {};
          parent = res;
          res = res[currentKey];
          res._parent = parent;
          currentKey = null;
        }
        break;
      case 'dt_array':
        res[currentKey] = [];
        parent = res;
        res = res[currentKey];
        res._parent = parent;
        currentKey = null;
        break;
      case 'item':
        currentKey = attrs[0][1];
        break;
      default:
        //console.log(elem);
        break;
      }
    });

    p.onEndElementNS((elem) => {

      const isContainer = (elem === 'dt_assoc' || elem === 'dt_array');

      if (isContainer && res && res._parent) {
        parent = res._parent;
        delete res._parent;
        res = parent;
      }

      currentKey = null;
    });

    p.onCharacters((chars) => {

      if (currentKey) {
        if (res.push) {
          res.push(chars);
        }
        else {
          switch (currentKey) {
          case 'response_code':
          case 'page':
          case 'remainder':
          case 'total':
          case 'balance':
          case 'hold_balance':
            chars = Number(chars);
            break;
          case 'is_success':
            chars = Boolean(chars);
            break;
          }

          res[currentKey] = chars;
          if (typeof chars === 'string'){
              if(oldKey !== currentKey) {
                  oldKey = currentKey;
                  currentKeyStringParts = "";
                  res[currentKey] = currentKeyStringParts;
              }
              if(oldKey === currentKey) {
                  currentKeyStringParts += chars;
                  res[currentKey] = currentKeyStringParts;
              }
          }
        }
      }
    });

    p.onWarning((msg) => cb(msg));
    p.onError((msg) => cb(msg));
  });

  parser.parseString(responseXml);
};


module.exports = (options) => {

  const settings = extend({}, defaults, options);
  const host = (settings.sandbox) ? 'horizon.opensrs.net' : 'rr-n1-tor.opensrs.net';
  let activeRequests = 0;

  if (typeof settings.user !== 'string' || typeof settings.key !== 'string') {
    throw new TypeError('options.user and options.key must be strings');
  }

  //
  // ### Send API request.
  //
  // #### Arguments
  //
  // * _String_ **obj** The API object name, ie: 'balance', 'domain', ...
  // * _String_ **method** The API method, ie; 'get_balance', ...
  // * _Object_ **params** [Optional] An object containing parameters to be
  //   passed in the request.
  // * _Function_ **cb** Callback invoked when the response is complete.
  //   This function will have two arguments , an error object and the
  //   response data. If successful the error object will be null.
  //
  const client = (...args) => {

    const obj = args.shift();
    const method = args.shift();
    const cb = args.pop() || (() => {});
    const params = args.shift();
    const xml = buildXmlPayload(obj, method, params);
    const request = buildRequest(host, settings.user, settings.key, xml);
    let responseRaw = '';

    const done = (err, data) => {

      activeRequests--;
      cb(err, data);
    };

    activeRequests++;
    const stream = Tls.connect(rpc_handler_port, host, () => {

      if (!stream || !stream.readable || !stream.writable) {
        return done(new Error('Could not connect to server ' + host +
                              ' on port ' + rpc_handler_port));
      }
      stream.write(request);
    })
      .on('error', (err) => {

        done(err);
      })
      .on('data', (buf) => {

        responseRaw += buf.toString();
      })
      .on('end', () => {

        const lines = responseRaw.split('\n');
        let flag = false;
        let responseXml = '';

        for (let i = 0; i < lines.length; ++i) {
          if (flag) {
            responseXml += lines[i] + '\n';
          }
          else if (/^<\?xml/.test(lines[i].trim())) {
            flag = true;
            i--;
          }
          else if (lines[i].trim() === '') {
            flag = true;
          }
        }

        if (responseXml === '') {
          return done(null, '');
        }

        parseResponse(responseXml, (err, res) => {

          if (err) {
            done(err, null);
          }
          else if (!res.is_success) {
            done(res, null);
          }
          else {
            // remove redundant properties
            delete res.protocol;
            delete res.action;
            delete res.object;
            done(null, res);
          }
        });
      });
  };

  client._activeRequests = () => {

    return activeRequests;
  };

  return client;

};


// Export `parseResponse` for testing
module.exports._parseResponse = parseResponse;
