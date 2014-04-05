inside = require 'point-in-polygon'
ndarray = require 'ndarray'

class Box2d

    constructor: ->

        @x_min = Number.POSITIVE_INFINITY
        @x_max = Number.NEGATIVE_INFINITY
        @y_min = Number.POSITIVE_INFINITY
        @y_max = Number.NEGATIVE_INFINITY

    updateRangeXY: (x, y) ->

        @x_min = x if x < @x_min
        @x_max = x if x > @x_max
        @y_min = y if y < @y_min
        @y_max = y if y > @y_max

    updateRange: (p) ->

        @updateRangeXY p[0], p[1]

    dX: ->

        @x_max - @x_min

    dY: ->

        @y_max - @y_min

    centerX: ->

        (@x_min + @x_max) / 2

    centerY: ->

        (@y_min + @y_max) / 2

scutil = 

    floodfillScanline: (map, x, y) ->

        width  = map.shape[0]
        height = map.shape[1]

        # xMin, xMax, y, down[true] / up[false], extendLeft, extendRight
        ranges = [[x, x, y, null, true, true]]
        map.set x, y, 1

        while ranges.length > 0

            r = ranges.pop()
            down = r[3] is true
            up   = r[3] is false
        
            # extendLeft
            minX = r[0]
            y = r[2]
            
            if r[4]
                while minX > 0 and map.get(minX - 1, y) isnt 1
                    minX--
                    map.set minX, y, 1

            # extendRight
            maxX = r[1]

            if r[5]
                while maxX < width - 1 and map.get(maxX + 1, y) isnt 1
                    maxX++
                    map.set maxX, y, 1
        
            # extend range ignored from previous line
            r[0]--
            r[1]++
        
            addNextLine = (newY, isNext, downwards) ->

                rMinX = minX
                inRange = false

                for x in [minX .. maxX]

                    # skip testing, if testing previous line within previous range
                    empty = (isNext or (x < r[0] or x > r[1])) and map.get(x, newY) isnt 1

                    if not inRange and empty
                        rMinX = x
                        inRange = true
                    else if inRange and not empty
                        ranges.push [rMinX, x - 1, newY, downwards, rMinX is minX, false]
                        inRange = false
                    
                    map.set x, newY, 1 if inRange

                    # skip
                    x = r[1] if not isNext and x is r[0]
                
                ranges.push [rMinX, x - 1, newY, downwards, rMinX is minX, true] if inRange
        
            addNextLine y + 1, not up, true if y < height
            addNextLine y - 1, not down, false if y > 0

            true
    
    supercoverLine: (map, p1, p2) ->

        x1 = p1[0]
        y1 = p1[1]
        x2 = p2[0]
        y2 = p2[1]
        x = x1
        y = y1
        dx = x2 - x1
        dy = y2 - y1
        map.set x1, y1, 1

        if dy < 0
            ystep = -1
            dy = -dy
        else
            ystep = 1

        if dx < 0
            xstep = -1
            dx = -dx
        else
            xstep = 1

        ddy = 2 * dy    # work with double values for full precision
        ddx = 2 * dx

        if ddx >= ddy

            # compulsory initialization (even for errorprev, needed when dx==dy)
            errorprev = error = dx  # start in the middle of the square

            for i in [0 ... dx]

                x += xstep
                error += ddy

                if error > ddx   # increment y if AFTER the middle ( > )
                    
                    y += ystep
                    error -= ddx
                    
                    # three cases (octant == right->right-top for directions below):
                    if error + errorprev < ddx # bottom square also
                        map.set x, y-ystep, 1
                    else if error + errorprev > ddx # left square also
                        map.set x-xstep, y, 1
                    else # corner: bottom and left squares also
                        map.set x, y-ystep, 1
                        map.set x-xstep, y, 1

                map.set x, y, 1
                errorprev = error

        else

            errorprev = error = dy

            for i in [0 ... dy]

                y += ystep
                error += ddx
                
                if error > ddy

                    x += xstep
                    error -= ddy

                    if error + errorprev < ddy
                        map.set x-xstep, y, 1
                    else if error + errorprev > ddy
                        map.set x, y-ystep, 1
                    else
                        map.set x-xstep, y, 1
                        map.set x, y-ystep, 1
                
                map.set x, y, 1
                errorprev = error

    getBoundary: (points) ->

        box = new Box2d()
        box.updateRange p for p in points

        box

    getLatLngRegion: (points) ->

        box = scutil.getBoundary()

            NorthEast:
                Lat: box.x_max
                Lng: box.y_max
            SouthWest:
                Lat: box.x_min
                Lng: box.y_min

    discretize: (points) ->

        # calculate bound offsets
        boundary = scutil.getBoundary points
        offsetx = -boundary.x_min
        offsety = -boundary.y_min
        dx = boundary.dX()
        dy = boundary.dY()

        # generate offseted points
        polygon = []
        polygon.push [p[0] + offsetx, p[1] + offsety] for p in points

        # generate map
        map = ndarray new Uint8Array((dx + 1) * (dy + 1)), [dx + 1, dy + 1]

        # cover border
        scutil.supercoverLine map, polygon[0], polygon[polygon.length - 1]
        scutil.supercoverLine map, polygon[i - 1], polygon[i] for i in [1 ... polygon.length]

        # find a point in polygon
        while true
            x = Math.floor(Math.random() * dx)
            y = Math.floor(Math.random() * dy)
            if inside([x, y], polygon)
                scutil.floodfillScanline map, x, y
                break
        
        # iterate all points
        ret = []
        for i in [0 .. dx]
            for j in [0 .. dy]
                if map.get(i, j) is 1
                    ret.push
                        x: i - offsetx
                        y: j - offsety

        ret

module.exports = scutil