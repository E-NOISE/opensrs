var assert = require('assert');
var opensrs = require('../');
var config = require('./config.json');

// heper functions
function pad(n) { return (n < 10) ? '0' + n : n; }
function formatDate(d) {
  return [ d.getFullYear(), pad((d.getMonth() + 1)), pad(d.getDate()) ].join('-');
}


describe('client', function () {

  var client = opensrs(config);

  it('should get balance', function (done) {
    client('balance', 'get_balance', function (err, data) {
      assert.ok(!err);
      assert.equal(data.response_text, 'Command successful');
      assert.equal(typeof data.attributes.balance, 'number');
      assert.equal(typeof data.attributes.hold_balance, 'number');
      assert.equal(data.response_code, 200);
      assert.equal(data.is_success, true);
      done();
    });
  });

  it('should handle domain lookup no domain param failure', function (done) {
    var client = opensrs(config);
    client('domain', 'lookup', function (err, data) {
      assert.ok(!err);
      assert.ok(data.response_text);
      assert.equal(data.response_code, 701);
      assert.equal(data.is_success, true);
      done();
    });
  });

  it('should handle domain lookup bad domain failure', function (done) {
    var client = opensrs(config);
    client('domain', 'lookup', { domain: 'xxx' }, function (err, data) {
      assert.ok(!err);
      assert.ok(data.response_text);
      assert.equal(data.response_code, 701);
      assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domain lookup available', function (done) {
    var client = opensrs(config);
    client('domain', 'lookup', { domain: 'lupomontero.com' }, function (err, data) {
      assert.ok(!err);
      assert.equal(data.response_text, 'Domain available');
      assert.equal(data.response_code, 210);
      assert.ok(data.attributes);
      assert.equal(data.attributes.status, 'available');
      assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domain lookup taken', function (done) {
    var client = opensrs(config);
    client('domain', 'lookup', { domain: 'e-noise-test9.com' }, function (err, data) {
      assert.ok(!err);
      assert.equal(data.response_text, 'Domain taken');
      assert.equal(data.response_code, 211);
      assert.ok(data.attributes);
      assert.equal(data.attributes.status, 'taken');
      assert.equal(data.is_success, true);
      done();
    });
  });

  it('should get domains by expire date', function (done) {
    var client = opensrs(config);
    var now = new Date();
    var params = {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 300
    };

    client('domain', 'get_domains_by_expiredate', params, function (err, data) {
      assert.ok(!err);
      assert.ok(data && data.is_success);
      assert.equal(data.response_code, 200);
      assert.ok(data.attributes && data.attributes.exp_domains);
      done();
    });
  });

  it('should handle multiple sequential and concurrent calls', function (done) {
    var client = opensrs(config);
    var count = 0;
    var now = new Date();
    var params = {
      exp_from: formatDate(now),
      exp_to: formatDate(new Date(+now + 60 * 24 * 60 * 60 * 1000)), //60 days from now
      limit: 30
    };

    function next() {
      assert.equal(client._activeRequests(), 2 - count);
      if (++count === 3) { done(); }
    }

    client('balance', 'get_balance', function (err, data) {
      assert.equal(data.response_code, 200);
      next();
    });
    client('domain', 'get_domains_by_expiredate', params, function (err, data) {
      assert.equal(data.response_code, 200);
      next();
    });
    client('balance', 'get_balance', function (err, data) {
      client('domain', 'get_domains_by_expiredate', params, function (err, data) {
        assert.ok(!err);
        assert.ok(data && data.is_success);
        assert.equal(data.response_code, 200);
        assert.ok(data.attributes && data.attributes.exp_domains);
        next();
      });
    });
    assert.equal(client._activeRequests(), 3);
  });

});

