var Utils = GLOBAL.Utils = {

    getCount: function(a) {
        var b = 0;
        for(var c in a) {
            b++;
        }
        return b;
    },

    getBoundsParamsForWorld: function() {

        return {
            bounds: {
                sw: {
                    lat: function() {return -90;},
                    lng: function() {return -180;}
                },
                ne: {
                    lat: function() {return 90;},
                    lng: function() {return 180;}
                }
            }
        }

    },

    extractNormalizeFunction: function(nemesis) {

        var funcOriginal = nemesis.dashboard.requests.normalizeParamCount.toString();
        funcOriginal = funcOriginal.replace(/goog\.now/g, 'Date.now');
        funcOriginal = funcOriginal.replace(/goog\.object\.getCount/g, 'Utils.getCount');
        funcOriginal = funcOriginal.replace(/nemesis\.dashboard\.BoundsParams\.getBoundsParamsForWorld/g, 'Utils.getBoundsParamsForWorld');

        return funcOriginal;

    },

    createNormalizeFunction: function(str) {

        return new Function('obj', 'return (' + str + ')(obj)');
    },

    extractMungeFromStock: function(nemesis) {

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
        var reg = new RegExp('GET_THINNED_ENTITIES, nemesis.dashboard.network.XhrController.Priority.[A-Z]+, {'+mungeRegExpLit+'[a-z]');
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
        var reg = new RegExp('SEND_PLEXT, nemesis.dashboard.network.XhrController.Priority.[A-Z]+, {'+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z], '+mungeRegExpLit+'[a-z]}');
        var result = reg.exec(nemesis.dashboard.network.PlextStore.prototype.sendPlext.toString());

        foundMunges.message = result[1] || result[2];
        foundMunges.latE6 = result[3] || result[4];
        foundMunges.lngE6 = result[5] || result[6];
        var chatTab = result[7] || result[8];
        if (chatTab != foundMunges.chatTab) throw 'Error: inconsistent munge parsing for chatTab';

        // GET_PORTAL_DETAILS
        var reg = new RegExp('GET_PORTAL_DETAILS, nemesis.dashboard.network.XhrController.Priority.[A-Z]+, {'+mungeRegExpLit+'a}');
        var result = reg.exec(nemesis.dashboard.network.DataFetcher.prototype.getPortalDetails.toString());
        foundMunges.guid = result[1] || result[2];

        // SEND_INVITE_EMAIL
        var reg = new RegExp('SEND_INVITE_EMAIL, nemesis.dashboard.network.XhrController.Priority.[A-Z]+, {'+mungeRegExpLit+'b}');
        foundMunges.inviteeEmailAddress = result[1] || result[2];

        return foundMunges;

    },

    getMapZoomTileParameters: function(zoom) {
        // these arrays/constants are based on those in the stock intel site. it's essential we keep them in sync with their code
        // (it may be worth reading the values from their code rather than using our own copies? it's a case of either
        //  breaking if they rename their variables if we do, or breaking if they change the values if we don't)
        var ZOOM_TO_TILES_PER_EDGE = [32, 32, 32, 32, 256, 256, 256, 1024, 1024, 1536, 4096, 4096, 16384, 16384, 16384];
        var MAX_TILES_PER_EDGE = 65536;
        var ZOOM_TO_LEVEL = [8, 8, 8, 8, 7, 7, 7, 6, 6, 5, 4, 4, 3, 2, 2, 1, 1];
    
        return {
            level: ZOOM_TO_LEVEL[zoom] || 0,  // default to level 0 (all portals) if not in array
            tilesPerEdge: ZOOM_TO_TILES_PER_EDGE[zoom] || MAX_TILES_PER_EDGE,
            zoom: zoom  // include the zoom level, for reference
        };
    },

    lngToTile: function(lng, params) {
        return Math.floor((lng + 180) / 360 * params.tilesPerEdge);
    },

    latToTile: function(lat, params) {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * params.tilesPerEdge);
    },

    tileToLng: function(x, params) {
        return x / params.tilesPerEdge * 360 - 180;
    },

    tileToLat: function(y, params) {
        var n = Math.PI - 2 * Math.PI * y / params.tilesPerEdge;
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    },

    pointToTileId: function(params, x, y) {
        return params.zoom + "_" + x + "_" + y;
    },

    clampLat: function(lat) {
        // the map projection used does not handle above approx +- 85 degrees north/south of the equator
        if (lat > 85.051128)
            lat = 85.051128;
        else if (lat < -85.051128)
            lat = -85.051128;
        return lat;
    },

    clampLng: function(lng) {
        if (lng > 179.999999)
            lng = 179.999999;
        else if (lng < -180.0)
            lng = -180.0;
        return lng;
    },

    clampLatLng: function(latlng) {
        return new L.LatLng ( Utils.clampLat(latlng.lat), Utils.clampLng(latlng.lng) );
    },

    clampLatLngBounds: function(bounds) {
        return new L.LatLngBounds ( Utils.clampLatLng(bounds.getSouthWest()), Utils.clampLatLng(bounds.getNorthEast()) );
    },

    requestDataMunge: function(data, activeMunge, normalizeFunc) {

        function munge(obj) {

            if (Object.prototype.toString.call(obj) === '[object Array]') {
                // an array - munge each element of it
                var newobj = [];
                for (var i in obj) {
                    newobj[i] = munge(obj[i]);
                }
                return newobj;
            } else if (typeof obj === 'object') {
                // an object: munge each property name, and pass the value through the munge process
                var newobj = Object();
                for (var p in obj) {
                    var m = activeMunge[p];
                    if (m === undefined) {
                        console.error(('Error: failed to find munge for object property ' + p).red);
                        newobj[p] = obj[p];
                    } else {
                        // rename the property
                        newobj[m] = munge(obj[p]);
                    }
                }
                return newobj;
            } else {
                // neither an array or an object - so must be a simple value. return it unmodified
                return obj;
            }

        };

        var newdata = munge(data);
        
        try {
            newdata = normalizeFunc(newdata);
        } catch(err) {}
        
        return newdata;
    },

    //$.extend
    extend: function() {

        for (var i = 1; i < arguments.length; i++)
            for (var key in arguments[i])
                if (arguments[i].hasOwnProperty(key))
                    arguments[0][key] = arguments[i][key];

        return arguments[0];

    },

}