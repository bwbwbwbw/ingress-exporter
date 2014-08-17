id2index = {}
id2portal = {}
dis = []

module.exports = 

    onBootstrap: (callback) ->

        if argv.farm
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    teamMapper =
        resistance: 'RESISTANCE'
        res:        'RESISTANCE'
        enlightened:'ENLIGHTENED'
        enl:        'ENLIGHTENED'
        neutral:    'NEUTRAL'
        all:        null

    # condition: more than 5 portals (>lv7) in 300m
    argv.radius = argv.radius || 500
    argv.nearby = argv.nearby || 5
    argv.level  = argv.level  || 7
    argv.radius = parseFloat argv.radius
    argv.level  = parseInt   argv.level
    argv.nearby = parseInt   argv.nearby
    argv.team   = teamMapper[argv.team.toLowerCase()] if argv.team
    argv.level  = 0 if argv.team is 'NEUTRAL'

    Database.db.collection('Portals').find().toArray (err, portals) ->

        logger.info '[FarmHunter] Optimizing (part 1)...' if argv.output

        dis = new Array(portals.length)
        for po, i in portals
            # transform for faster calculation
            po.posXY = millerXY po.latE6 / 1e6, po.lngE6 / 1e6
            id2index[po._id] = i 
            dis[i] = new Array(portals.length)

        # pre-calculate distances
        logger.info '[FarmHunter] Optimizing (part 2)...' if argv.output

        for po1, i in portals
            for po2, j in portals
                dis[i][j] = getPortalDistance po1, po2
                dis[j][i] = dis[i][j]

        # get possible farm protals
        logger.info '[FarmHunter] Calculating nearby portals...' if argv.output

        possibleFarmPortals = []

        for po, i in portals
            continue if po.level < argv.level
            continue if po.team isnt argv.team if argv.team
            po.nearbys = getNearbyPortals po, portals
            possibleFarmPortals.push po if po.nearbys.length > argv.nearby

        callback()

        # DFS
        logger.info '[FarmHunter] Finding farms...' if argv.output

        farms = []
        visited = {}

        searchNearby = (po, onFound) ->

            for nearby in po.nearbys

                continue if visited[nearby._id]
                
                onFound nearby
                visited[nearby._id] = true

                searchNearby nearby, onFound

        for po in possibleFarmPortals

            continue if visited[po._id]

            farmPortals = []
            farmPortals.push po
            visited[po._id] = true

            searchNearby po, (portal) ->
                farmPortals.push portal

            farms.push farmPortals

        # output
        outputFarm = []

        for farm in farms
            
            fNew = []

            for po in farm
                fNew.push
                    title: po.title
                    guid:  po._id
                    latE6: po.latE6
                    lngE6: po.lngE6
                    level: po.level
                    team:  po.team

            outputFarm.push fNew

        if argv.output
            fs = require 'fs'
            fs.writeFileSync argv.output, JSON.stringify(outputFarm, null, 4)
        else
            console.log JSON.stringify(outputFarm, null, 4)

        logger.info '[FarmHunter] Found %d farms', farms.length if argv.team

        callback()

getNearbyPortals = (portal, portals) ->

    nearbyPortals = []
    index = id2index[portal._id]

    for po in portals

        continue if po._id is portal._id
        continue if po.team isnt argv.team if argv.team
        continue if parseInt(po.level) < argv.level
        continue if dis[index][id2index[po._id]] > argv.radius

        nearbyPortals.push po

    nearbyPortals

getPortalDistance = (po1, po2) ->

    x = po1.posXY.x - po2.posXY.x
    y = po1.posXY.y - po2.posXY.y

    Math.sqrt x * x + y * y

millerXY = (lat, lng) ->

    L = 6381372 * Math.PI * 2
    W = L
    H = L / 2
    mill = 2.3
    x = lng * Math.PI / 180
    y = lat * Math.PI / 180

    y = 1.25 * Math.log( Math.tan( 0.25 * Math.PI + 0.4 * y ) )
    
    x = ( W / 2 ) + ( W / (2 * Math.PI) ) * x
    y = ( H / 2 ) - ( H / ( 2 * mill ) ) * y
    
    x: x
    y: y
