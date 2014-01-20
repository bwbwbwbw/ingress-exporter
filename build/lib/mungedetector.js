(function() {
  var MungeDetector, Munges, NemesisMethodName, async, extractMunge, tryMungeSet;

  async = require('async');

  NemesisMethodName = null;

  Munges = GLOBAL.Munges = {
    Data: null,
    ActiveSet: 0
  };

  MungeDetector = GLOBAL.MungeDetector = {
    detect: function(callback) {
      TaskManager.begin();
      return async.series([
        function(callback) {
          return Database.db.collection('MungeData').findOne({
            _id: 'munge'
          }, function(err, record) {
            if (record != null) {
              Munges.Data = record.data;
              Munges.ActiveSet = record.index;
            }
            return callback();
          });
        }, function(callback) {
          if (Munges.Data === null) {
            callback();
            return;
          }
          logger.info('[MungeDetector] Trying to use internal munge data.');
          return tryMungeSet(Munges.Data[Munges.ActiveSet], function(err) {
            if (err == null) {
              callback('done');
              return;
            }
            logger.warn('[MungeDetector] Failed.');
            return callback();
          });
        }, function(callback) {
          logger.info('[MungeDetector] Trying to extract munge data from ingress.com/intel.');
          return extractMunge(function(err) {
            if (err == null) {
              callback('new');
              return;
            }
            logger.warn('[MungeDetector] Failed.');
            return callback();
          });
        }, function(callback) {
          return callback('fail');
        }
      ], function(err) {
        if (err === 'done' || err === 'new') {
          logger.info('[MungeDetector] Detect successfully.');
          if (err === 'new') {
            return Database.db.collection('MungeData').update({
              _id: 'munge'
            }, {
              $set: {
                data: Munges.Data,
                index: Munges.ActiveSet
              }
            }, {
              upsert: true
            }, function(err) {
              logger.info('[MungeDetector] Munge data saved.');
              callback && callback();
              TaskManager.end('MungeDetector.detect');
            });
          } else {
            callback && callback();
            TaskManager.end('MungeDetector.detect');
          }
        } else {
          logger.error('[MungeDetector] Could not detect munge data. Tasks are terminated.');
          TaskManager.end('MungeDetector.detect');
          return process.exit(0);
        }
      });
    }
  };

  tryMungeSet = function(munge, callback) {
    var task;
    task = Request.generate({
      munge: munge,
      action: 'getGameScore',
      data: {},
      onSuccess: function(response) {
        return callback && callback();
      },
      onError: function(err) {
        return callback && callback(err);
      }
    });
    return Request.post('/r/' + task.m, task.d, function(error, response, body) {
      if (error) {
        task.error && task.error(error);
        return;
      }
      if (!Request.processResponse(error, response, body)) {
        logger.error('[DEBUG] Unknown server response');
        return;
      }
      if (typeof body === 'string') {
        task.error && task.error(body);
        return;
      }
      if (body.error != null) {
        task.error && task.error(body.error);
        return;
      }
      return task.success && task.success(body);
    });
  };

  extractMunge = function(callback) {
    return Request.get('/jsc/gen_dashboard.js', function(error, response, body) {
      var err, export_obj, extractMungeFromStock, google, result;
      if (error) {
        callback('fail');
        return;
      }
      body = body.toString();
      export_obj = {};
      google = {
        maps: {
          OverlayView: function() {
            return null;
          }
        }
      };
      eval(body + ';export_obj.nemesis = nemesis;');
      extractMungeFromStock = function(nemesis) {
            var foundMunges = {};

            // these are easy - directly available in variables
            // NOTE: the .toString() is there so missing variables throw an exception, rather than storing 'undefined'
            foundMunges['dashboard.getArtifactInfo'] = nemesis.dashboard.requests.MethodName.GET_ARTIFACT_INFO.toString();
            foundMunges['dashboard.getGameScore'] = nemesis.dashboard.requests.MethodName.GET_GAME_SCORE.toString();
            foundMunges['dashboard.getPaginatedPlexts'] = nemesis.dashboard.requests.MethodName.GET_PAGINATED_PLEXTS.toString();
            foundMunges['dashboard.getThinnedEntities'] = nemesis.dashboard.requests.MethodName.GET_THINNED_ENTITIES.toString();
            foundMunges['dashboard.getPortalDetails'] = nemesis.dashboard.requests.MethodName.GET_PORTAL_DETAILS.toString();
            foundMunges['dashboard.redeemReward'] = nemesis.dashboard.requests.MethodName.REDEEM_REWARD.toString();
            foundMunges['dashboard.sendInviteEmail'] = nemesis.dashboard.requests.MethodName.SEND_INVITE_EMAIL.toString();
            foundMunges['dashboard.sendPlext'] = nemesis.dashboard.requests.MethodName.SEND_PLEXT.toString();

            // the rest are trickier - we need to parse the functions of the stock site. these break very often
            // on site updates

            // regular expression - to match either x.abcdef123456wxyz or x["123456abcdefwxyz"] format for property access
            var mungeRegExpProp = '(?:\\.([a-z][a-z0-9]{15})|\\["([0-9][a-z0-9]{15})"\\])';
            // and one to match members of object literal initialisation - {abcdef123456wxyz: or {"123456abcdefwxyz":
            var mungeRegExpLit = '(?:([a-z][a-z0-9]{15})|"([0-9][a-z0-9]{15})"):';

            // common parameters - method, version, version_parameter - currently found in the 
            // nemesis.dashboard.network.XhrController.prototype.doSendRequest_ function
            // look for something like
            //  var e = a.getData();
            //  e["3sld77nsm0tjmkvi"] = c;
            //  e.xz7q6r3aja5ttvoo = "b121024077de2a0dc6b34119e4440785c9ea5e64";
            var reg = new RegExp('getData\\(\\);.*\\n.*'+mungeRegExpProp+' =.*\n.*'+mungeRegExpProp+' *= *"([a-z0-9]{40})','m');
            var result = reg.exec(nemesis.dashboard.network.XhrController.prototype.doSendRequest_.toString());
            // there's two ways of matching the munge expression, so try both
            foundMunges.method = result[1] || result[2];
            foundMunges.version = result[3] || result[4];
            foundMunges.version_parameter = result[5];

            // GET_THINNED_ENTITIES parameters
            var reg = new RegExp('GET_THINNED_ENTITIES, {'+mungeRegExpLit+'[a-z]');
            var result = reg.exec(nemesis.dashboard.network.DataFetcher.prototype.getGameEntities.toString());
            foundMunges.quadKeys = result[1] || result[2];

            // GET_PAGINATED_PLEXTS
            var reg = new RegExp('GET_PAGINATED_PLEXTS, [a-z] = [a-z] \\|\\| nemesis.dashboard.BoundsParams.getBoundsParamsForWorld\\(\\), [a-z] = [a-z] \\|\\| -1, [a-z] = [a-z] \\|\\| -1, [a-z] = {'+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'Math.round\\([a-z].bounds.sw.lat\\(\\) \\* 1E6\\), '+mungeRegExpLit+'Math.round\\([a-z].bounds.sw.lng\\(\\) \\* 1E6\\), '+mungeRegExpLit+'Math.round\\([a-z].bounds.ne.lat\\(\\) \\* 1E6\\), '+mungeRegExpLit+'Math.round\\([a-z].bounds.ne.lng\\(\\) \\* 1E6\\), '+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z]};\n *[a-z]'+mungeRegExpProp+' = [a-z];\n *[a-z] > -1 && \\([a-z]'+mungeRegExpProp+' = true\\);', 'm');
            var result = reg.exec(nemesis.dashboard.network.PlextStore.prototype.getPlexts.toString());

            foundMunges.desiredNumItems = result[1] || result[2];
            
            foundMunges.minLatE6 = result[3] || result[4];
            foundMunges.minLngE6 = result[5] || result[6];
            foundMunges.maxLatE6 = result[7] || result[8];
            foundMunges.maxLngE6 = result[9] || result[10];
            foundMunges.minTimestampMs = result[11] || result[12];
            foundMunges.maxTimestampMs = result[13] || result[14];
            foundMunges.chatTab = result[15] || result[16];  //guessed parameter name - only seen munged
            foundMunges.ascendingTimestampOrder = result[17] || result[18];

            // SEND_PLEXT
            var reg = new RegExp('SEND_PLEXT, {'+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z]}');
            var result = reg.exec(nemesis.dashboard.network.PlextStore.prototype.sendPlext.toString());

            foundMunges.message = result[1] || result[2];
            foundMunges.latE6 = result[3] || result[4];
            foundMunges.lngE6 = result[5] || result[6];
            var chatTab = result[7] || result[8];
            if (chatTab != foundMunges.chatTab) throw 'Error: inconsistent munge parsing for chatTab';

            // GET_PORTAL_DETAILS
            var reg = new RegExp('GET_PORTAL_DETAILS, {'+mungeRegExpLit+'a}');
            var result = reg.exec(nemesis.dashboard.network.DataFetcher.prototype.getPortalDetails.toString());

            foundMunges.guid = result[1] || result[2];

            // SEND_INVITE_EMAIL
            var reg = new RegExp('SEND_INVITE_EMAIL, {'+mungeRegExpLit+'b}');
            foundMunges.inviteeEmailAddress = result[1] || result[2];

            return foundMunges;
        };
      try {
        result = extractMungeFromStock(export_obj.nemesis);
      } catch (_error) {
        err = _error;
        callback('fail');
        return;
      }
      Munges.Data = [result];
      Munges.ActiveSet = 0;
      return tryMungeSet(Munges.Data[Munges.ActiveSet], function(err) {
        if (err == null) {
          callback();
          return;
        }
        return callback('fail');
      });
    });
  };

}).call(this);
