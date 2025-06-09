import * as admin from "firebase-admin";

export type QueryDocumentSnapshotType = admin.firestore.QueryDocumentSnapshot<
  admin.firestore.DocumentData,
  admin.firestore.DocumentData
>;
