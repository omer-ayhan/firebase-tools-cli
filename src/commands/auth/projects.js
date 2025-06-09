const chalk = require("chalk");
const { OAuth2Client } = require("google-auth-library");

// FIXED: Better project listing with proper API endpoint
async function listUserProjects(credentials) {
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
      const firebaseResponse = await oauth2Client.request({
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
    const response = await oauth2Client.request({
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
    console.warn(chalk.yellow("⚠️  Could not fetch projects:"), error.message);

    if (error.message.includes("403")) {
      console.log(
        chalk.yellow(
          "💡 This might be a permissions issue. Make sure your Google account has access to Firebase/Cloud projects."
        )
      );
    }

    return [];
  }
}

module.exports = {
  listUserProjects,
};
