import React from 'react';
import { StatusBar } from 'expo-status-bar';
import App from './App';

export default function RootApp() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F1115" />
      <App />
    </>
  );
}
