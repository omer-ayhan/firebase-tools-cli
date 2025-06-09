// const chalk = require("chalk");
// const { OAuth2Client } = require("google-auth-library");

import chalk from "chalk";
import { Credentials, OAuth2Client } from "google-auth-library";

type ProjectType = {
  projectId: string;
  displayName: string;
  state: string;
  lifecycleState: string;
  name: string;
};
// FIXED: Better project listing with proper API endpoint
async function listUserProjects(credentials: Credentials) {
  try {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      token_type: credentials.token_type,
    });

    console.log(
      chalk.gray("Fetching projects from Firebase Management API...")
    );

    // FIXED: Use Firebase Management API instead of Cloud Resource Manager
    try {
      // First try Firebase Management API
      const firebaseResponse = await oauth2Client.request<{
        results: ProjectType[];
      }>({
        url: "https://firebase.googleapis.com/v1beta1/projects",
        method: "GET",
      });

      if (firebaseResponse.data && firebaseResponse.data.results) {
        console.log(
          chalk.green(
            `✅ Found ${firebaseResponse.data.results.length} Firebase projects`
          )
        );
        return firebaseResponse.data.results.map((project) => ({
          projectId: project.projectId,
          name: project.displayName || project.projectId,
          lifecycleState: project.state || "ACTIVE",
        }));
      }
    } catch (firebaseError) {
      console.log(
        chalk.yellow(
          "⚠️  Firebase Management API not accessible, trying Cloud Resource Manager..."
        )
      );
    }

    // Fallback to Cloud Resource Manager API
    const response = await oauth2Client.request<{
      projects: ProjectType[];
    }>({
      url: "https://cloudresourcemanager.googleapis.com/v1/projects",
      method: "GET",
    });

    if (response.data && response.data.projects) {
      console.log(
        chalk.green(
          `✅ Found ${response.data.projects.length} Google Cloud projects`
        )
      );
      return response.data.projects.filter(
        (project) => project.lifecycleState === "ACTIVE"
      );
    }

    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.warn(chalk.yellow("⚠️  Could not fetch projects:"), errorMessage);

    if (errorMessage.includes("403")) {
      console.log(
        chalk.yellow(
          "💡 This might be a permissions issue. Make sure your Google account has access to Firebase/Cloud projects."
        )
      );
    }

    return [];
  }
}

export {
  listUserProjects,
};
