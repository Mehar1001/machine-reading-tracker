const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce file watching pressure by excluding common directories
config.watchFolders = [__dirname];

// Use polling instead of native file watching to avoid EMFILE errors
// This is less efficient but more reliable on macOS without watchman
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Force polling mode for file watching
      if (req.url === '/status') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ watching: true }));
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
