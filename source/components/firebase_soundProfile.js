// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  getDocs,
} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDZopCl6jqND4sFYCSiB1GpCXreXd6-Q9s",
  authDomain: "speaker-calibration.firebaseapp.com",
  databaseURL: "https://speaker-calibration-default-rtdb.firebaseio.com",
  projectId: "speaker-calibration",
  storageBucket: "speaker-calibration.appspot.com",
  messagingSenderId: "322038930574",
  appId: "1:322038930574:web:d10ca9e7d60b6da9bafddf",
  measurementId: "G-3724GD92R6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig, "soundProfile");
export const db = getFirestore(app);

export const getSoundProfileStatement = async () => {
  const Loudspeakers = await getLoudspeakers();
  const Microphones = await getMicrophones();
  const uniqueMicrophones = await getUniqueMicrophones(Microphones);
  const uniqueLoudspeakers = await getUniqueLoudspeakers(Loudspeakers);
  const totalMicrophones = Microphones.length;
  const totalLoudspeakers = Loudspeakers.length;

  return `${totalMicrophones} (${uniqueMicrophones} unique) for microphones, ${totalLoudspeakers} (${uniqueLoudspeakers} unique) for loudspeakers`;
};

const getUniqueMicrophones = async (Microphones) => {
  // two microphones are the same if they have the same microhone.info.ID_from_51Degrees (if exists), microphone.info.OEM and microphone.info.ID
  const uniqueMicrophonesIDs = [];
  for (const microphone of Microphones) {
    const ID_from_51Degrees = microphone.info.ID_from_51Degrees;
    const OEM = microphone.info.OEM;
    const ID = microphone.info.ID;
    const uniqueMicrophone = `${ID_from_51Degrees}_${OEM}_${ID}`;
    if (!uniqueMicrophonesIDs.includes(uniqueMicrophone)) {
      uniqueMicrophonesIDs.push(uniqueMicrophone);
    }
  }
  return uniqueMicrophonesIDs.length;
};

const getUniqueLoudspeakers = async (Loudspeakers) => {
  // two loudspeakers are the same if they have the same loudspeaker.DeviceId, loudspeaker.OEM and loudspeaker.ID
  const uniqueLoudspeakersIDs = [];
  for (const loudspeaker of Loudspeakers) {
    const DeviceId = loudspeaker.DeviceId;
    const OEM = loudspeaker.OEM;
    const ID = loudspeaker.ID;
    const uniqueLoudspeaker = `${DeviceId}_${OEM}_${ID}`;
    if (!uniqueLoudspeakersIDs.includes(uniqueLoudspeaker)) {
      uniqueLoudspeakersIDs.push(uniqueLoudspeaker);
    }
  }
  return uniqueLoudspeakersIDs.length;
};

const getLoudspeakers = async () => {
  const loudspeakers = [];
  const querySnapshot = await getDocs(collection(db, "Loudspeaker"));

  for (const doc of querySnapshot.docs) {
    const collectionIDs = doc.data().collectionIDs;
    for (const collectionID of collectionIDs) {
      const col = collection(db, "Loudspeaker", doc.id, collectionID);
      await getDocs(col).then((docs) => {
        docs.forEach((doc) => {
          loudspeakers.push(doc.data());
        });
      });
    }
  }
  return loudspeakers;
};

const getMicrophones = async () => {
  const microphones = [];
  const querySnapshot = await getDocs(collection(db, "Microphone"));

  for (const doc of querySnapshot.docs) {
    const collectionIDs = doc.data().collectionIDs;
    for (const collectionID of collectionIDs) {
      const col = collection(db, "Microphone", doc.id, collectionID);
      await getDocs(col).then((docs) => {
        docs.forEach((doc) => {
          microphones.push(doc.data());
        });
      });
    }
  }
  return microphones;
};
