module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@components': './components',
            '@features': './features',
            '@lib': './lib',
            '@hooks': './hooks',
            '@types': './types',
            '@data': './data',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
