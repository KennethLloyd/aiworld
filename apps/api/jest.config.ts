import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.m?[jt]s$': [
      'ts-jest',
      { tsconfig: 'test/tsconfig.jest.json', diagnostics: false },
    ],
  },
  moduleNameMapper: {
    '^@thallesp/nestjs-better-auth$':
      '<rootDir>/test/__mocks__/nestjs-better-auth.ts',
    '^@aiworld/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@aiworld/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['mjs', 'js', 'json', 'ts'],
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
};

export default config;
