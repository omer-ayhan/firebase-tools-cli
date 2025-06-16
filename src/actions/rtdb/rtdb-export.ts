import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

import { countNodes } from '@/utils';

type ExportRTDBOptionsType = {
  exclude?: string[];
  subcollections?: boolean;
  detailed?: boolean;
  importable?: boolean;
  output?: string;
};

export async function exportRealtimeDatabase(options: ExportRTDBOptionsType) {
  try {
    console.log(chalk.blue('🔍 Starting Realtime Database export...\n'));

    // Get the database reference (should be configured during initialization)
    const rtdbApp = admin.app('rtdb-app');
    const rtdb = rtdbApp.database();

    console.log(chalk.cyan('📁 Fetching all data from Realtime Database\n'));

    // Get the root reference and fetch all data
    const snapshot = await rtdb.ref('/').once('value');
    let allData = snapshot.val();

    if (!allData) {
      console.log(chalk.yellow('⚠️  No data found in Realtime Database'));
      return;
    }

    // Handle exclusions
    if (options.exclude && Array.isArray(options.exclude)) {
      console.log(
        chalk.yellow(`⏭️  Excluding paths: ${options.exclude.join(', ')}`)
      );
      for (const excludePath of options.exclude) {
        if (allData[excludePath]) {
          delete allData[excludePath];
          console.log(chalk.gray(`   └── Excluded: ${excludePath}`));
        }
      }
    }

    // Handle no-subcollections (flatten to top level only)
    if (options.subcollections === false) {
      console.log(chalk.yellow('📏 Limiting export to top-level data only'));
      const topLevelData: {
        [key: string]: string | unknown;
      } = {};

      for (const [key, value] of Object.entries(allData)) {
        // Only include primitive values or convert objects to string representation
        if (typeof value === 'object' && value !== null) {
          topLevelData[key] = `[Object with ${Object.keys(value).length} keys]`;
        } else {
          topLevelData[key] = value;
        }
      }
      allData = topLevelData;
    }

    // Generate file names
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = options.output || './';

    console.log(chalk.blue('💾 Saving export files...'));

    // Create saving loading indicator
    let savingDots = 0;
    let savingInterval = setInterval(() => {
      const dots = '.'.repeat((savingDots % 3) + 1);
      process.stdout.write(`\r${chalk.gray(`   └── Writing files${dots}   `)}`);
      savingDots++;
    }, 200);

    let filesCreated = 0;

    // Save detailed format (includes metadata)
    if (options.detailed !== false) {
      const detailedData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          source: 'Firebase Realtime Database',
          databaseUrl: rtdbApp.options.databaseURL,
          exportedBy: 'firebase-tools-cli',
          totalNodes: countNodes(allData),
        },
        data: allData,
      };

      const detailedFile = path.join(
        outputDir,
        `rtdb_detailed_${timestamp}.json`
      );
      fs.writeFileSync(detailedFile, JSON.stringify(detailedData, null, 2));
      filesCreated++;

      clearInterval(savingInterval);
      process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line
      console.log(chalk.green(`📄 Detailed backup saved: ${detailedFile}`));

      // Restart saving indicator if we have more files to save
      if (options.importable !== false) {
        savingInterval = setInterval(() => {
          const dots = '.'.repeat((savingDots % 3) + 1);
          process.stdout.write(
            `\r${chalk.gray(`   └── Writing files${dots}   `)}`
          );
          savingDots++;
        }, 200);
      }
    }

    // Save importable format (clean data only)
    if (options.importable !== false) {
      const importableFile = path.join(
        outputDir,
        `rtdb_importable_${timestamp}.json`
      );
      fs.writeFileSync(importableFile, JSON.stringify(allData, null, 2));
      filesCreated++;

      clearInterval(savingInterval);
      process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line
      console.log(chalk.green(`📤 Importable backup saved: ${importableFile}`));
    }

    // Summary
    console.log(chalk.blue('\n📊 Export Summary:'));
    console.log(chalk.gray(`   └── Database: ${rtdbApp.options.databaseURL}`));
    console.log(
      chalk.gray(`   └── Total nodes exported: ${countNodes(allData)}`)
    );
    console.log(chalk.gray(`   └── Files created: ${filesCreated}`));

    // Calculate file sizes
    if (options.detailed !== false) {
      const detailedFile = path.join(
        outputDir,
        `rtdb_detailed_${timestamp}.json`
      );
      const detailedSize = (
        fs.statSync(detailedFile).size /
        1024 /
        1024
      ).toFixed(2);
      console.log(chalk.gray(`   └── Detailed file size: ${detailedSize} MB`));
    }

    if (options.importable !== false) {
      const importableFile = path.join(
        outputDir,
        `rtdb_importable_${timestamp}.json`
      );
      const importableSize = (
        fs.statSync(importableFile).size /
        1024 /
        1024
      ).toFixed(2);
      console.log(
        chalk.gray(`   └── Importable file size: ${importableSize} MB`)
      );
    }

    console.log(
      chalk.green('\n🎉 Realtime Database export completed successfully!')
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ RTDB Export failed:'), errorMessage);

    if (errorMessage.includes('PERMISSION_DENIED')) {
      console.log(chalk.yellow('💡 Make sure:'));
      console.log(chalk.gray('   • Your account has Realtime Database access'));
      console.log(chalk.gray('   • The database exists and has data'));
      console.log(chalk.gray('   • Database rules allow read access'));
    } else if (errorMessage.includes('Database URL')) {
      console.log(chalk.yellow('💡 Database URL troubleshooting:'));
      console.log(chalk.gray('   • Use --database-url flag'));
      console.log(
        chalk.gray(
          '   • Check the URL format (should end with .firebasedatabase.app)'
        )
      );
      console.log(
        chalk.gray('   • Verify the database exists in your project')
      );
    }

    throw error;
  }
}
