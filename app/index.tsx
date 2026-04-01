import React from 'react';
import { StatusBar } from 'expo-status-bar';
import App from './App';

export default function RootApp() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <App />
    </>
  );
}
