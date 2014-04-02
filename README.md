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
Remember to execute `grunt` after you modifying `config.coffee` or updating repo.

### Run

```
node build/app.js

--portals            Request portals information
--broadcasts         Request public broadcast messages
--export             Export portals (output to stdout)
--trace              Trace a player's destroy/deploy/link history (experimental)
--farm               Find farms (experimental)
--detect false       Don't detect munge data & player info (optional)
                     Overwrites --detectmunge and --detectplayer
                     (You may need this when using --export or --trace)
--detectmunge false  Don't detect munge data (optional)
--detectplayer false Don't detect player info (optional)
--cookie COOKIE      The cookie to use (overwrite config.coffee, optional)
```

Requesting portals (`--portals`):

```
--new    -n          Start new requests (otherwise continue, optional)
--detail false       Don't request portals details (faster, optional)
```

Requesting broadcasts (`--broadcasts`):

```
--new    -n          Start new requests (otherwise continue, optional)
--tracedays N        Trace history of N days (overwrite config.coffee, optional)
```

Exporting portals (`--export`):

```
--output FILE        Output to the file instead of stdout (optional)
--title  -t          Include title
--latlng -l          Include lat & lng
--id     -i          Include guid
--image  -I          Include image URI
```

Tracing player (`--trace`):

```
--output FILE        Output to the file instead of stdout (optional)
--player PLAYER      The player to trace (case sensitive)
```

Finding farms (`--farm`):

```
--output FILE        Output to the file instead of stdout (optional)
--radius R           Minimum distance of portals (unit: m) (default: 500)
--nearby N           Minimum nearby portals for a farm     (default: 5)
--level  LEVEL       Minimum level of portals              (default: 7)
--team   RES|ENL|ALL Farm filter                           (default: ALL)
```

# Warning

Using this script is likely to be considered against the Ingress Terms of Service. Any use is at your own risk.

# License

The MIT License