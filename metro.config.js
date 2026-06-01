// Standard Expo Metro config. Extends expo/metro-config so transformer,
// resolver, and asset handling match the Expo SDK defaults (also satisfies
// expo-doctor's Metro check). Add customizations to `config` below if needed.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
