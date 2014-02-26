ingress-exporter
========================

Export all portals, links, fields and system broadcasts in a specific geo-region.

# Requirement

Node.js > 0.10

MongoDB > 2.2

# Install

```bash
npm install
npm install -g grunt-cli
grunt
```

# Usage

```
node build/app.js
```

### Basic options

```
--portals     Request portals information
--broadcasts  Request public broadcast messages
--export      Export portals to csv
```

### Request portals and broadcasts options

```
--new    -n   Start new requests (otherwise continue)
```

### Export options

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