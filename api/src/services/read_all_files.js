const fs = require('fs');
const path = require('path');
const _ = require('lodash');

module.exports = {
  execute: (fullPath, extension) => {
    const readFiles = {};
    const dir = fs.readdirSync(fullPath);
    dir.forEach((file) => {
      const ext = file.split('.').pop();
      if (ext === extension) {
        readFiles[file] = fs.readFileSync(path.join(fullPath, file), 'utf8');
      }
    });
    return _.mapKeys(readFiles, (value, key) => {
      // Removes extensions and returns filename in camelcase
      return _.camelCase(key.replace(/\.[^/.]+$/, ''));
    });
  },
};
