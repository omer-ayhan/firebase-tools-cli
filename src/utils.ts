import inquirer from 'inquirer';

function countNodes(data: any, count: number = 0): number {
  if (data === null || data === undefined) {
    return count;
  }

  if (typeof data === 'object') {
    count++; // Count this object
    for (const key in data) {
      count = countNodes(data[key], count);
    }
  } else {
    count++; // Count primitive values
  }

  return count;
}

// Helper function to determine value type
function determineValueType(value: any): string {
  if (typeof value === 'boolean') {
    return 'BOOLEAN';
  } else if (typeof value === 'number') {
    return 'NUMBER';
  } else if (typeof value === 'object' && value !== null) {
    return 'JSON';
  } else {
    return 'STRING';
  }
}

function validateDatabaseUrl(url: string): boolean {
  const urlPattern = /^https:\/\/.*\.firebasedatabase\.app\/?$/;
  return urlPattern.test(url.trim());
}

async function promptDatabaseUrl() {
  const { databaseUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'databaseUrl',
      message: 'Enter Firebase Realtime Database URL:',
      validate: (input) => {
        console.log('input', input);
        if (!input.trim()) {
          return 'Please enter a valid database URL';
        }

        if (!validateDatabaseUrl(input.trim())) {
          return 'Please enter a valid Firebase Realtime Database URL (e.g., https://your-project-default-rtdb.firebaseio.com/)';
        }

        return true;
      },
      filter: (input) => input.trim().replace(/\/$/, ''), // Remove trailing slash
    },
  ]);

  return databaseUrl;
}

export {
  countNodes,
  determineValueType,
  validateDatabaseUrl,
  promptDatabaseUrl,
};
