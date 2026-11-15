// Metro configuration with monorepo and pnpm support
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Monitorea cambios en todos los paquetes del monorepo
config.watchFolders = [monorepoRoot];

// 2. Permite a Metro resolver módulos instalados en la raíz o en los paquetes
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
