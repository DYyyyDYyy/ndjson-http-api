import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
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

function toText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  return text.trim() === '' || text === 'null' ? '' : text;
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

function matches(record, maxMpg) {
  if (maxMpg === null) {
    return true;
  }
  const mpg = toNumber(record.mpg);
  // null < 22 у JS дає true, тому записи без числа відсіюємо окремо
  return mpg !== null && mpg < maxMpg;
}

function toItem(record, showCyl) {
  const item = { model: toText(record.model) };
  if (showCyl) {
    item.cyl = toNumber(record.cyl);
  }
  item.mpg = toNumber(record.mpg);
  return item;
}

function respond(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function errorBody(message) {
  return JSON.stringify({ error: message });
}

function send(res, status, body) {
  if (!options.output) {
    respond(res, status, body);
    return;
  }

  // відповідь надсилається після запису, щоб помилку запису можна було повернути як 500
  fs.writeFile(options.output, body, (err) => {
    if (err) {
      console.error(`Помилка запису у файл ${options.output}: ${err.message}`);
      if (status === 200) {
        respond(res, 500, errorBody('Не вдалося записати відповідь у файл'));
        return;
      }
    }
    respond(res, status, body);
  });
}

function sendError(res, status, message) {
  send(res, status, errorBody(message));
}

function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    sendError(res, 400, 'Некоректна адреса запиту');
    return;
  }

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
      const items = parseNdjson(text)
        .filter((record) => matches(record, maxMpg))
        .map((record) => toItem(record, showCyl));
      body = JSON.stringify(items);
    } catch {
      sendError(res, 500, 'Файл даних пошкоджено');
      return;
    }

    send(res, 200, body);
  });
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch {
      sendError(res, 500, 'Внутрішня помилка сервера');
    }
  });

  server.on('error', (err) => {
    console.error(`Не вдалося запустити сервер: ${err.message}`);
    process.exit(1);
  });

  server.listen(options.port, options.host, () => {
    console.log(`Сервер працює: http://${options.host}:${options.port}/`);
  });
}

fs.access(options.input, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  if (options.output && path.resolve(options.output) === path.resolve(options.input)) {
    console.error('Файл для відповідей не може збігатися з файлом даних');
    process.exit(1);
  }
  startServer();
});
