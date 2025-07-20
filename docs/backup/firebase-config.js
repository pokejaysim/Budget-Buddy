// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDN4xO1OX9SdnFEsh5t5h4GNoP8Z-AzZDI",
    authDomain: "budget-buddy-40d7e.firebaseapp.com",
    projectId: "budget-buddy-40d7e",
    storageBucket: "budget-buddy-40d7e.firebasestorage.app",
    messagingSenderId: "598043340486",
    appId: "1:598043340486:web:33a22fdcb9e614f9a671c7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser does not support offline persistence');
        }
    });