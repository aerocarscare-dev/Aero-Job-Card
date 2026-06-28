import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aerocarscare.aerojobs',
  appName: 'Aero Jobs',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
