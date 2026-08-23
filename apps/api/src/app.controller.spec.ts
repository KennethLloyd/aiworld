import { AppController } from './app.controller';

describe('AppController', () => {
  it('exposes an anonymous deployment health contract', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
