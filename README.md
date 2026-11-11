# ndjson-http-api

A small HTTP JSON API over an NDJSON dataset (the classic `mtcars`), written on the built-in `node:http` module with no framework. Options are parsed with [commander](https://github.com/tj/commander.js); messages are in Ukrainian.

```bash
npm install
npm start          # node main.js -i mtcars.json -h 127.0.0.1 -p 3000
```

| Option | Meaning |
|---|---|
| `-i, --input <path>` | NDJSON data file (required) |
| `-h, --host <address>` | listen address (required) |
| `-p, --port <number>` | port, validated as an integer 1-65535 (required) |
| `-o, --output <path>` | also write the last successful response to this file; refuses to overwrite the input file |

## API

`GET /` returns the models as JSON. Query parameters:

| Parameter | Effect |
|---|---|
| `max_mpg=<number>` | only cars with fuel consumption below this mpg |
| `cylinders=true` | include the number of cylinders |

```text
$ curl '127.0.0.1:3000/?max_mpg=15&cylinders=true'
[{"model":"Duster 360","cyl":8,"mpg":14.3},{"model":"Cadillac Fleetwood","cyl":8,"mpg":10.4}, ...]
```

Errors are JSON too: `400` for a malformed URL or a non-numeric `max_mpg`, `404` for any other path.

## Details worth noting

- Records without a numeric `mpg` are filtered out explicitly: in JavaScript `null < 15` is `true`, so a plain comparison would let them through.
- Each NDJSON line is validated to be a JSON object; a broken line yields an error response instead of a crash.
- `Content-Length` is computed with `Buffer.byteLength`, so non-ASCII responses are not truncated.
- `test-data/edge-cases.json` holds malformed and boundary records for manual checks.

Written for the Web Programming course at Ivan Franko National University of Lviv (2026).
