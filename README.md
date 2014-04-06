ingress-exporter
========================

Export all portals, links, fields and system broadcasts in a specific area.

# Requirement

Node.js, MongoDB

# Install

```bash
npm install
npm install -g grunt-cli
grunt
```

# Usage

### Config

See `config.coffee.default` for details.
You need to copy and rename to `config.coffee` first before running.
Remember to execute `grunt` after you modifying `config.coffee` or updating repo.

How to generate polygon data via IITC drawtool:

```javascript
window.plugin.drawTools.drawnItems.eachLayer(function(layer) {
    if (!(layer instanceof L.GeodesicPolygon)) {
        return;
    }
    var latlngs = [];
    layer.getLatLngs().forEach(function(p) {
        latlngs.push([p.lat, p.lng]);
    });
    console.log(JSON.stringify(latlngs));
});
```

### Example

#### Request all portals and details (resonators, mods, owner, ...)

```
node build/app.js --portals --new
```

#### Request all portals without details

```
node build/app.js --portals --detail false --new
```

#### Request public messages

```
node build/app.js --broadcasts
```

#### Request faction messages

```
node build/app.js --faction
```

#### Export all portals to csv file with title and image

```
node build/app.js --export -tI --output output.csv --detect false
```

### Trace a player's activities based on database and output to csv file

```
node build/app.js --trace --player Vivian --detect false
```

#### Search farms based on database and output to json file

```
node build/app.js --farm --output farm.json
```

### Options

```
node build/app.js

--portals            Request portals information
--broadcasts         Request public broadcast messages
--faction            Request faction messages
--export             Export portals (output to stdout)
--trace              Trace a player's destroy/deploy/link history (experimental)
--farm               Find farms (experimental)
--detect false       Don't detect munge data & player info (optional)
                     Overwrites --detectmunge and --detectplayer
                     (You may need this when using --export, --trace or --farm)
--detectmunge false  Don't detect munge data (optional)
--detectplayer false Don't detect player info (optional)
--cookie COOKIE      The cookie to use (overwrite config.coffee, optional)
```

Requesting portals (`--portals`):

```
--new    -n          Start new requests (otherwise continue, optional)
--detail false       Don't request portals details (faster, optional)
```

Requesting public/faction (`--broadcasts` or `--faction`):

```
--new    -n          Start new requests (otherwise continue, optional)
--tracedays N        Trace history of N days (overwrite config.coffee, optional)
```

Exporting portals (`--export`):

```
--title  -t          Include title
--latlng -l          Include lat & lng
--id     -i          Include guid
--image  -I          Include image URI
--output FILE        Output to the file instead of stdout (optional)
```

Tracing player (`--trace`):

```
--player PLAYER      The player to trace (case sensitive)
--output FILE        Output to the file instead of stdout (optional)
```

Finding farms (`--farm`):

```
--radius R           Minimum distance of portals (unit: m) (default: 500)
--nearby N           Minimum nearby portals for a farm     (default: 5)
--level  LEVEL       Minimum level of portals              (default: 7)
--team   RES|ENL|ALL Farm filter                           (default: ALL)
--output FILE        Output to the file instead of stdout (optional)
```

# Warning

Using this script is likely to be considered against the Ingress Terms of Service. Any use is at your own risk.

# License

The MIT License