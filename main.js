import fs from 'node:fs';
import http from 'node:http';
import { Command, InvalidArgumentError } from 'commander';

function parsePort(value) {
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new InvalidArgumentError('порт має бути цілим числом від 1 до 65535');
  }
  return port;
}

const program = new Command();

program
  .description('HTTP-сервер, що віддає дані з файлу у форматі JSON')
  .helpOption('--help', 'вивести довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера', parsePort)
  .option('-o, --output <path>', 'файл, у який записується остання відповідь');

program.parse();

const options = program.opts();

function toNumber(value) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

function parseNdjson(text) {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const record = JSON.parse(line);
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('рядок не є JSON-об’єктом');
      }
      return record;
    });
}

function respond(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message) {
  respond(res, status, JSON.stringify({ error: message }));
}

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname !== '/') {
    sendError(res, 404, 'Маршрут не знайдено');
    return;
  }

  const showCyl = url.searchParams.get('cylinders') === 'true';
  const maxMpgParam = url.searchParams.get('max_mpg');
  const maxMpg = maxMpgParam === null ? null : toNumber(maxMpgParam);

  if (maxMpgParam !== null && maxMpg === null) {
    sendError(res, 400, 'Параметр max_mpg має бути числом');
    return;
  }

  fs.readFile(options.input, 'utf8', (err, text) => {
    if (err) {
      sendError(res, 500, 'Не вдалося прочитати файл даних');
      return;
    }

    let body;
    try {
      body = JSON.stringify(parseNdjson(text));
    } catch {
      sendError(res, 500, 'Файл даних пошкоджено');
      return;
    }

    respond(res, 200, body);
  });
}

function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(options.port, options.host, () => {
    console.log(`Сервер працює: http://${options.host}:${options.port}/`);
  });
}

fs.access(options.input, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  startServer();
});
