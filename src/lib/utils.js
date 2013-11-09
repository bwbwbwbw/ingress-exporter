var SLOT_TO_LAT = [0, Math.sqrt(2)/2, 1, Math.sqrt(2)/2, 0, -Math.sqrt(2)/2, -1, -Math.sqrt(2)/2];
var SLOT_TO_LNG = [1, Math.sqrt(2)/2, 0, -Math.sqrt(2)/2, -1, -Math.sqrt(2)/2, 0, Math.sqrt(2)/2];
var EARTH_RADIUS = 6378137;
var LEVEL_TO_TILES_PER_EDGE = [65536, 65536, 16384, 16384, 4096, 1536, 1024, 256, 32];

var Utils = GLOBAL.Utils = {

    requestDataMunge: function(data, activeMunge) {

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

    // MAP DATA REQUEST CALCULATORS //////////////////////////////////////
    // Ingress Intel splits up requests for map data (portals, links,
    // fields) into tiles. To get data for the current viewport (i.e. what
    // is currently visible) it first calculates which tiles intersect.
    // For all those tiles, it then calculates the lat/lng bounds of that
    // tile and a quadkey. Both the bounds and the quadkey are “somewhat”
    // required to get complete data.
    //
    // Convertion functions courtesy of
    // http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

    levelToTilesPerEdge: function(level) {
        return LEVEL_TO_TILES_PER_EDGE[level];
    },


    lngToTile: function(lng, level) {
        return Math.floor((lng + 180) / 360 * Utils.levelToTilesPerEdge(level));
    },

    latToTile: function(lat, level) {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Utils.levelToTilesPerEdge(level));
    },

    tileToLng: function(x, level) {
        return x / Utils.levelToTilesPerEdge(level) * 360 - 180;
    },

    tileToLat: function(y, level) {
        var n = Math.PI - 2 * Math.PI * y / Utils.levelToTilesPerEdge(level);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    },

    pointToTileId: function(level, x, y) {
        return level + "_" + x + "_" + y;
    },

    // given tile id and bounds, returns the format as required by the
    // Ingress API to request map data.
    generateBoundsParams: function(tile_id, minLat, minLng, maxLat, maxLng) {
        return {
            id: tile_id,
            qk: tile_id,
            minLatE6: Math.round(minLat * 1E6),
            minLngE6: Math.round(minLng * 1E6),
            maxLatE6: Math.round(maxLat * 1E6),
            maxLngE6: Math.round(maxLng * 1E6)
        };
    },

    getResonatorLatLng: function(dist, slot, portalLatLng) {
        // offset in meters
        var dn = dist * SLOT_TO_LAT[slot];
        var de = dist * SLOT_TO_LNG[slot];

        // Coordinate offset in radians
        var dLat = dn / EARTH_RADIUS;
        var dLon = de / (EARTH_RADIUS * Math.cos(Math.PI / 180 * portalLatLng[0]));

        // OffsetPosition, decimal degrees
        var lat0 = portalLatLng[0] + dLat * 180 / Math.PI;
        var lon0 = portalLatLng[1] + dLon * 180 / Math.PI;

        return [lat0, lon0];
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
    }

}