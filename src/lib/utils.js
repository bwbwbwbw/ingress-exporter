var Utils = GLOBAL.Utils = {

    extractIntelData: function(jsSource) {
        // To stay the same with IITC, we don't extract essential data directly,
        // instead, we build a virual environment, then call IITC functions.
        // 
        // Because of there are no `window` object in NodeJS, we need to expose
        // those global variables in order to let IITC functions work without
        // any modification.
        var window = {};
        var source = jsSource;

        // extract global variables
        var globalVars = [];

        var esprima = require('esprima');
        var escope = require('escope');

        var tree = esprima.parse(source);
        globalScope = escope.analyze(tree).scopes[0];
        globalScope.variables.forEach(function (v) {
            globalVars.push(v.identifiers[0].name);
        });

        // expose global variables
        globalVars.forEach(function(name) {
            source = source + ';window.' + name + ' = ' + name + ';';
        });

        // stimulate Google Map object
        source = 'var google={maps:{OverlayView:function(){}}};' + source;
        source = 'var IS_TABLET=false;' + source;

        // execute JavaScript
        eval(source);
        Utils.extractFromStock(window);

        if (window.niantic_params.CURRENT_VERSION == undefined) {
            throw new Error('Failed to extract version');
        }

        return window.niantic_params;
    },

    // from IITC code
    extractFromStock: function(window) {
      var niantic_params = window.niantic_params = {}

      //TODO: need to search through the stock intel minified functions/data structures for the required variables
      // just as a *very* quick fix, test the theory with hard-coded variable names


      // extract the former nemesis.dashboard.config.CURRENT_VERSION from the code
      var reVersion = new RegExp('[a-z]=[a-z].getData\\(\\);[a-z].v="([a-f0-9]{40})";');


      var minified = new RegExp('^[a-zA-Z$][a-zA-Z$0-9]$');

      for (var topLevel in window) {
        if (minified.test(topLevel)) {
          // a minified object - check for minified prototype entries

          // the object has a prototype - iterate through the properties of that
          if (window[topLevel] && window[topLevel].prototype) {
            for (var secLevel in window[topLevel].prototype) {
              if (minified.test(secLevel)) {

                // looks like we've found an object of the format "XX.prototype.YY"...

                var item = window[topLevel].prototype[secLevel];

                if (item && typeof(item) == "function") {
                  // a function - test it against the relevant regular expressions
                  var funcStr = item.toString();

                  var match = reVersion.exec(funcStr);
                  if (match) {
                    //console.log('Found former CURRENT_VERSION in '+topLevel+'.prototype.'+secLevel);
                    niantic_params.CURRENT_VERSION = match[1];
                  }

                }

              }
            }

          }
        }
      }
    },

    getMapZoomTileParameters: function(zoom) {
        // these arrays/constants are based on those in the stock intel site. it's essential we keep them in sync with their code
        // (it may be worth reading the values from their code rather than using our own copies? it's a case of either
        //  breaking if they rename their variables if we do, or breaking if they change the values if we don't)
        var ZOOM_TO_TILES_PER_EDGE = [64, 64, 64, 64, 256, 256, 256, 1024, 1024, 1536, 4096, 4096, 6500, 6500, 6500];
        var MAX_TILES_PER_EDGE = 9000;
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
        //change to quadkey construction
        //as of 2014-05-06: zoom_x_y_minlvl_maxlvl_maxhealth
        
        return params.zoom + "_" + x + "_" + y + "_" + params.level + "_8_100";
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

    //$.extend
    extend: function() {

        for (var i = 1; i < arguments.length; i++)
            for (var key in arguments[i])
                if (arguments[i].hasOwnProperty(key))
                    arguments[0][key] = arguments[i][key];

        return arguments[0];

    },

}
