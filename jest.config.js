/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/lib/__tests__/**/*.test.ts'],
  // Los mismos alias que tsconfig/babel: algunos módulos de datos (el catálogo
  // de ejercicios) los usan.
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@data/(.*)$': '<rootDir>/data/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          jsx: 'react',
        },
      },
    ],
  },
};
