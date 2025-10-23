import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAodyozqGZGZWLLEVrw10zb-APVJBoCmnk",
  authDomain: "simplimarked-web.firebaseapp.com",
  databaseURL: "https://simplimarked-web-default-rtdb.firebaseio.com",
  projectId: "simplimarked-web",
  storageBucket: "simplimarked-web.firebasestorage.app",
  messagingSenderId: "667189673599",
  appId: "1:667189673599:web:8818d3a16402d2bc97894a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);

