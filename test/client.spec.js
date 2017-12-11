'use strict';


const Assert = require('assert');
const OpenSRS = require('../');
const Config = require('./config.json');

// heper functions
const pad = function (n) {

  return (n < 10) ? '0' + n : n;
};

const formatDate = function (d) {

  return [d.getFullYear(), pad((d.getMonth() + 1)), pad(d.getDate())].join('-');
};


describe('client', () => {

  const client = OpenSRS(Config);

  it('should get balance', (done) => {

    client('balance', 'get_balance', (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.response_text, 'Command successful');
      Assert.equal(typeof data.attributes.balance, 'number');
      Assert.equal(typeof data.attributes.hold_balance, 'number');
      Assert.equal(data.response_code, 200);
      Assert.equal(data.is_success, true);
      done();
    });
  });

  it('should handle domain lookup no domain param failure', (done) => {

    OpenSRS(Config)('domain', 'lookup', (err, data) => {

      Assert.ok(!err);
      Assert.ok(data.response_text);
      Assert.equal(data.response_code, 701);
      Assert.equal(data.is_success, true);
      done();
    });
  });

  it('should handle domain lookup bad domain failure', (done) => {

    OpenSRS(Config)('domain', 'lookup', { domain: 'xxx' }, (err, data) => {

      Assert.ok(!err);
      Assert.ok(data.response_text);
      Assert.equal(data.response_code, 701);
      Assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domain lookup available', (done) => {

    OpenSRS(Config)('domain', 'lookup', {
      domain: 'lupomontero' + Date.now() + '.com'
    }, (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.response_text, 'Domain available');
      Assert.equal(data.response_code, 210);
      Assert.ok(data.attributes);
      Assert.equal(data.attributes.status, 'available');
      Assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domain lookup taken', (done) => {

    OpenSRS(Config)('domain', 'lookup', {
      domain: 'e-noise-test9.com'
    }, (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.response_text, 'Domain taken');
      Assert.equal(data.response_code, 211);
      Assert.ok(data.attributes);
      Assert.equal(data.attributes.status, 'taken');
      Assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domains by expire date', (done) => {

    const now = new Date();

    OpenSRS(Config)('domain', 'get_domains_by_expiredate', {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 300
    }, (err, data) => {

      Assert.ok(!err);
      Assert.ok(data && data.is_success);
      Assert.equal(data.response_code, 200);
      Assert.ok(data.attributes && data.attributes.exp_domains);
      done();
    });
  });

  it('should handle multiple sequential and concurrent calls', (done) => {

    const client = OpenSRS(Config);
    let count = 0;
    const now = new Date();
    const params = {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 30
    };

    const next = function () {

      Assert.equal(client._activeRequests(), 2 - count);
      if (++count === 3) {
        done();
      }
    };

    client('balance', 'get_balance', (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.response_code, 200);
      next();
    });

    client('domain', 'get_domains_by_expiredate', params, (err, data) => {

      Assert.ok(!err);
      Assert.equal(data.response_code, 200);
      next();
    });

    client('balance', 'get_balance', (err, data) => {

      Assert.ok(!err);
      client('domain', 'get_domains_by_expiredate', params, (err, data) => {

        Assert.ok(!err);
        Assert.ok(data && data.is_success);
        Assert.equal(data.response_code, 200);
        Assert.ok(data.attributes && data.attributes.exp_domains);
        next();
      });
    });

    Assert.equal(client._activeRequests(), 3);
  });

});
