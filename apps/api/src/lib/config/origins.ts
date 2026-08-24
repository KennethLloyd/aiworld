export function getFrontendOrigins(): string[] {
  const developmentPort = process.env.WEB_PORT;
  if (developmentPort) {
    return [`http://localhost:${developmentPort}`];
  }

  return (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
