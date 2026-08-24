import * as fs from 'fs';
import * as path from 'path';

describe('main.ts', () => {
  const mainPath = path.join(__dirname, 'main.ts');

  it('should import helmet', () => {
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain("import helmet from 'helmet'");
  });

  it('should apply helmet middleware', () => {
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain('helmet(');
  });

  it('should disable bodyParser', () => {
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain('bodyParser: false');
  });

  it('should apply the global /api prefix', () => {
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain("setGlobalPrefix('api')");
  });

  it('should use the resolved API port and origin', () => {
    const content = fs.readFileSync(mainPath, 'utf-8');
    expect(content).toContain('appConfig.apiPort');
    expect(content).toContain('appConfig.apiOrigin');
  });
});
