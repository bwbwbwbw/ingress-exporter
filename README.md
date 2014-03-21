ingress-exporter
========================

Export all portals, links, fields and system broadcasts in a specific geo-region.

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
Remember to execute `grunt` after you modifying `config.coffee`.

### Run

```
node build/app.js
```

### Basic options

```
--portals            Request portals information
--broadcasts         Request public broadcast messages
--export             Export portals (output to stdout)
--detect false       Don't detect munge data & player info
                     Overwrites --detectmunge and --detectplayer
                     (You may need this when just exporting data)
--detectmunge false  Don't detect munge data
--detectplayer false Don't detect player info
--cookie COOKIE      Use the specific cookie instead of cookies in config.coffee
```

### Options of requesting portals and broadcasts

```
--new    -n   Start new requests (otherwise continue)
```

### Options of exporting portals

```
--title  -t   Include title
--latlng -l   Include lat & lng
--id     -i   Include guid
--image  -I   Include image URI
```

# Warning

Using this script is likely to be considered against the Ingress Terms of Service. Any use is at your own risk.

# License

The MIT License