
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ملاحظة: يجب استبدال هذه الإعدادات ببيانات مشروع Firebase الخاص بك من وحدة تحكم Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAs-DEMO-KEY-REPLACE-THIS",
  authDomain: "sport-logic-demo.firebaseapp.com",
  projectId: "sport-logic-demo",
  storageBucket: "sport-logic-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
