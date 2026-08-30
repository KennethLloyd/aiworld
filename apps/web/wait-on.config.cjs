const apiHost = process.env.API_HOST ?? 'localhost';
const apiPort = process.env.API_PORT ?? '3000';

module.exports = {
  resources: [`http-get://${apiHost}:${apiPort}/api/docs`],
  timeout: 60_000,
};
