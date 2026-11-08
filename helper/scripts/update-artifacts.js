#!/usr/bin/env node
const path = require('node:path');
const {main} = require('../agentv/server/update-artifacts');

main({root: path.resolve(__dirname, '../..')}).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
