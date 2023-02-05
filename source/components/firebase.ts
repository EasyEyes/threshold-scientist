// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBredrcRCoAwTeakgAW4TsYzEtxNYTzmiU",
  authDomain: "easyeyes-compiler.firebaseapp.com",
  projectId: "easyeyes-compiler",
  storageBucket: "easyeyes-compiler.appspot.com",
  messagingSenderId: "930762152800",
  appId: "1:930762152800:web:5c8228f0e264df736d9c05",
  measurementId: "G-J3MKPYWSCR",
  //
  databaseURL: "https://easyeyes-compiler-default-rtdb.firebaseio.com",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getDatabase(app);
