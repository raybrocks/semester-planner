import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "semester-planner-ray-26",
  appId: "1:380519427947:web:0ba04bb502113fdd9ba62e",
  storageBucket: "semester-planner-ray-26.firebasestorage.app",
  apiKey: "AIzaSyCLNxnjxyntncus7cEo1_Rn4LZP1xWoQio",
  authDomain: "semester-planner-ray-26.firebaseapp.com",
  messagingSenderId: "380519427947"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "semester-planner-db");
