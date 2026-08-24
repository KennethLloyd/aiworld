module.exports = {
  resources: [`http-get://localhost:${process.env.API_PORT ?? 3000}/api/docs`],
  timeout: 60_000,
};
