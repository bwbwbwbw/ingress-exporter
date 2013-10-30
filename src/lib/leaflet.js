var L = GLOBAL.L = {};

/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

L.Util = {
    extend: function (dest) { // (Object[, Object, ...]) ->
        var sources = Array.prototype.slice.call(arguments, 1),
            i, j, len, src;

        for (j = 0, len = sources.length; j < len; j++) {
            src = sources[j] || {};
            for (i in src) {
                if (src.hasOwnProperty(i)) {
                    dest[i] = src[i];
                }
            }
        }
        return dest;
    },

    bind: function (fn, obj) { // (Function, Object) -> Function
        var args = arguments.length > 2 ? Array.prototype.slice.call(arguments, 2) : null;
        return function () {
            return fn.apply(obj, args || arguments);
        };
    },

    stamp: (function () {
        var lastId = 0,
            key = '_leaflet_id';
        return function (obj) {
            obj[key] = obj[key] || ++lastId;
            return obj[key];
        };
    }()),

    invokeEach: function (obj, method, context) {
        var i, args;

        if (typeof obj === 'object') {
            args = Array.prototype.slice.call(arguments, 3);

            for (i in obj) {
                method.apply(context, [i, obj[i]].concat(args));
            }
            return true;
        }

        return false;
    },

    limitExecByInterval: function (fn, time, context) {
        var lock, execOnUnlock;

        return function wrapperFn() {
            var args = arguments;

            if (lock) {
                execOnUnlock = true;
                return;
            }

            lock = true;

            setTimeout(function () {
                lock = false;

                if (execOnUnlock) {
                    wrapperFn.apply(context, args);
                    execOnUnlock = false;
                }
            }, time);

            fn.apply(context, args);
        };
    },

    falseFn: function () {
        return false;
    },

    formatNum: function (num, digits) {
        var pow = Math.pow(10, digits || 5);
        return Math.round(num * pow) / pow;
    },

    trim: function (str) {
        return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    },

    splitWords: function (str) {
        return L.Util.trim(str).split(/\s+/);
    },

    setOptions: function (obj, options) {
        obj.options = L.extend({}, obj.options, options);
        return obj.options;
    },

    getParamString: function (obj, existingUrl, uppercase) {
        var params = [];
        for (var i in obj) {
            params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
        }
        return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
    },

    compileTemplate: function (str, data) {
        // based on https://gist.github.com/padolsey/6008842
        str = str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
            return '" + o["' + key + '"]' + (typeof data[key] === 'function' ? '(o)' : '') + ' + "';
        });
        // jshint evil: true
        return new Function('o', 'return "' + str + '";');
    },

    template: function (str, data) {
        var cache = L.Util._templateCache = L.Util._templateCache || {};
        cache[str] = cache[str] || L.Util.compileTemplate(str, data);
        return cache[str](data);
    },

    isArray: Array.isArray || function (obj) {
        return (Object.prototype.toString.call(obj) === '[object Array]');
    },

    emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
};

// shortcuts for most used utility functions
L.extend = L.Util.extend;
L.bind = L.Util.bind;
L.stamp = L.Util.stamp;
L.setOptions = L.Util.setOptions;

/*
 * L.LatLng represents a geographical point with latitude and longitude coordinates.
 */

L.LatLng = function (rawLat, rawLng) { // (Number, Number)
    var lat = parseFloat(rawLat),
        lng = parseFloat(rawLng);

    if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid LatLng object: (' + rawLat + ', ' + rawLng + ')');
    }

    this.lat = lat;
    this.lng = lng;
};

L.extend(L.LatLng, {
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    MAX_MARGIN: 1.0E-9 // max margin of error for the "equals" check
});

L.LatLng.prototype = {
    equals: function (obj) { // (LatLng) -> Boolean
        if (!obj) { return false; }

        obj = L.latLng(obj);

        var margin = Math.max(
            Math.abs(this.lat - obj.lat),
            Math.abs(this.lng - obj.lng));

        return margin <= L.LatLng.MAX_MARGIN;
    },

    toString: function (precision) { // (Number) -> String
        return 'LatLng(' +
            L.Util.formatNum(this.lat, precision) + ', ' +
            L.Util.formatNum(this.lng, precision) + ')';
    },

    // Haversine distance formula, see http://en.wikipedia.org/wiki/Haversine_formula
    // TODO move to projection code, LatLng shouldn't know about Earth
    distanceTo: function (other) { // (LatLng) -> Number
        other = L.latLng(other);

        var R = 6378137, // earth radius in meters
            d2r = L.LatLng.DEG_TO_RAD,
            dLat = (other.lat - this.lat) * d2r,
            dLon = (other.lng - this.lng) * d2r,
            lat1 = this.lat * d2r,
            lat2 = other.lat * d2r,
            sin1 = Math.sin(dLat / 2),
            sin2 = Math.sin(dLon / 2);

        var a = sin1 * sin1 + sin2 * sin2 * Math.cos(lat1) * Math.cos(lat2);

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    wrap: function (a, b) { // (Number, Number) -> LatLng
        var lng = this.lng;

        a = a || -180;
        b = b ||  180;

        lng = (lng + b) % (b - a) + (lng < a || lng === b ? b : a);

        return new L.LatLng(this.lat, lng);
    }
};

L.latLng = function (a, b) { // (LatLng) or ([Number, Number]) or (Number, Number)
    if (a instanceof L.LatLng) {
        return a;
    }
    if (L.Util.isArray(a)) {
        if (typeof a[0] === 'number' || typeof a[0] === 'string') {
            return new L.LatLng(a[0], a[1]);
        } else {
            return null;
        }
    }
    if (a === undefined || a === null) {
        return a;
    }
    if (typeof a === 'object' && 'lat' in a) {
        return new L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon);
    }
    if (b === undefined) {
        return null;
    }
    return new L.LatLng(a, b);
};

/*
 * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
 */

L.LatLngBounds = function (southWest, northEast) { // (LatLng, LatLng) or (LatLng[])
    if (!southWest) { return; }

    var latlngs = northEast ? [southWest, northEast] : southWest;

    for (var i = 0, len = latlngs.length; i < len; i++) {
        this.extend(latlngs[i]);
    }
};

L.LatLngBounds.prototype = {
    // extend the bounds to contain the given point or bounds
    extend: function (obj) { // (LatLng) or (LatLngBounds)
        if (!obj) { return this; }

        var latLng = L.latLng(obj);
        if (latLng !== null) {
            obj = latLng;
        } else {
            obj = L.latLngBounds(obj);
        }

        if (obj instanceof L.LatLng) {
            if (!this._southWest && !this._northEast) {
                this._southWest = new L.LatLng(obj.lat, obj.lng);
                this._northEast = new L.LatLng(obj.lat, obj.lng);
            } else {
                this._southWest.lat = Math.min(obj.lat, this._southWest.lat);
                this._southWest.lng = Math.min(obj.lng, this._southWest.lng);

                this._northEast.lat = Math.max(obj.lat, this._northEast.lat);
                this._northEast.lng = Math.max(obj.lng, this._northEast.lng);
            }
        } else if (obj instanceof L.LatLngBounds) {
            this.extend(obj._southWest);
            this.extend(obj._northEast);
        }
        return this;
    },

    // extend the bounds by a percentage
    pad: function (bufferRatio) { // (Number) -> LatLngBounds
        var sw = this._southWest,
            ne = this._northEast,
            heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
            widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

        return new L.LatLngBounds(
            new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
            new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
    },

    getCenter: function () { // -> LatLng
        return new L.LatLng(
            (this._southWest.lat + this._northEast.lat) / 2,
            (this._southWest.lng + this._northEast.lng) / 2);
    },

    getSouthWest: function () {
        return this._southWest;
    },

    getNorthEast: function () {
        return this._northEast;
    },

    getNorthWest: function () {
        return new L.LatLng(this.getNorth(), this.getWest());
    },

    getSouthEast: function () {
        return new L.LatLng(this.getSouth(), this.getEast());
    },

    getWest: function () {
        return this._southWest.lng;
    },

    getSouth: function () {
        return this._southWest.lat;
    },

    getEast: function () {
        return this._northEast.lng;
    },

    getNorth: function () {
        return this._northEast.lat;
    },

    contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
        if (typeof obj[0] === 'number' || obj instanceof L.LatLng) {
            obj = L.latLng(obj);
        } else {
            obj = L.latLngBounds(obj);
        }

        var sw = this._southWest,
            ne = this._northEast,
            sw2, ne2;

        if (obj instanceof L.LatLngBounds) {
            sw2 = obj.getSouthWest();
            ne2 = obj.getNorthEast();
        } else {
            sw2 = ne2 = obj;
        }

        return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
               (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
    },

    intersects: function (bounds) { // (LatLngBounds)
        bounds = L.latLngBounds(bounds);

        var sw = this._southWest,
            ne = this._northEast,
            sw2 = bounds.getSouthWest(),
            ne2 = bounds.getNorthEast(),

            latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
            lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

        return latIntersects && lngIntersects;
    },

    toBBoxString: function () {
        return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
    },

    equals: function (bounds) { // (LatLngBounds)
        if (!bounds) { return false; }

        bounds = L.latLngBounds(bounds);

        return this._southWest.equals(bounds.getSouthWest()) &&
               this._northEast.equals(bounds.getNorthEast());
    },

    isValid: function () {
        return !!(this._southWest && this._northEast);
    }
};

//TODO International date line?

L.latLngBounds = function (a, b) { // (LatLngBounds) or (LatLng, LatLng)
    if (!a || a instanceof L.LatLngBounds) {
        return a;
    }
    return new L.LatLngBounds(a, b);
};