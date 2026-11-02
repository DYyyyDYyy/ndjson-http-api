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

  respond(res, 200, '[]');
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
