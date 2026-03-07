import chalk from 'chalk';
import * as admin from 'firebase-admin';
import fs from 'fs';
import inquirer from 'inquirer';

type ImportRTDBOptionsType = {
  batchSize?: number;
  merge?: boolean;
  replace?: boolean;
};

export async function importRealtimeDatabase(
  file: string,
  options: ImportRTDBOptionsType
) {
  try {
    console.log(chalk.blue(`📥 Starting import from: ${file}\n`));

    if (!fs.existsSync(file)) {
      console.error(chalk.red(`❌ Import file not found: ${file}`));
      process.exit(1);
    }

    const rtdbApp = admin.app('rtdb-app');
    const rtdb = rtdbApp.database();

    // Prompt for confirmation when neither --merge nor --replace is specified
    if (!options.merge && !options.replace) {
      console.log(
        chalk.yellow(
          '⚠️  WARNING: This operation will OVERWRITE existing data in the Realtime Database.'
        )
      );
      console.log(
        chalk.yellow(
          '   Use --merge to merge with existing data or --replace to skip this prompt.'
        )
      );
      console.log(chalk.gray(`   Database: ${rtdbApp.options.databaseURL}`));
      console.log();

      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Do you want to proceed and overwrite the existing data?',
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('⚠️  Import cancelled by user.'));
        process.exit(0);
      }
    }

    const rawData = fs.readFileSync(file, 'utf8');
    const importData = JSON.parse(rawData);

    if (!importData || typeof importData !== 'object') {
      console.error(chalk.red('❌ Invalid import data format'));
      process.exit(1);
    }

    console.log(chalk.blue('📝 Starting data import...'));
    let totalImported = 0;
    const batchSize = options.batchSize || 500;

    // Process data in batches
    const processBatch = async (data: any, path: string = '') => {
      const batch: Promise<void>[] = [];
      let batchCount = 0;

      for (const [key, value] of Object.entries(data)) {
        const currentPath = path ? `${path}/${key}` : key;
        const ref = rtdb.ref(currentPath);

        if (typeof value === 'object' && value !== null) {
          // Recursively process nested objects
          await processBatch(value, currentPath);
        } else {
          // Add to current batch
          if (options.merge) {
            batch.push(ref.update({ [key]: value }));
          } else {
            batch.push(ref.set(value));
          }
          batchCount++;
          totalImported++;

          // Execute batch if size limit reached
          if (batchCount >= batchSize) {
            await Promise.all(batch);
            console.log(
              chalk.gray(`   └── Batch imported: ${batchCount} nodes`)
            );
            batch.length = 0;
            batchCount = 0;
          }
        }
      }

      // Execute remaining items in batch
      if (batch.length > 0) {
        await Promise.all(batch);
        console.log(chalk.gray(`   └── Final batch: ${batchCount} nodes`));
      }
    };

    // Start import process
    await processBatch(importData);

    console.log(chalk.green('\n📊 Import Summary:'));
    console.log(chalk.gray(`   └── Total nodes imported: ${totalImported}`));
    console.log(chalk.gray(`   └── Database: ${rtdbApp.options.databaseURL}`));
    console.log(
      chalk.gray(`   └── Mode: ${options.merge ? 'Merge' : 'Overwrite'}`)
    );

    console.log(chalk.green('\n🎉 Import completed successfully!'));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(chalk.red('❌ Import failed:'), errorMessage);

    if (errorMessage.includes('PERMISSION_DENIED')) {
      console.log(chalk.yellow('💡 Make sure:'));
      console.log(
        chalk.gray('   • Your account has Realtime Database write access')
      );
      console.log(chalk.gray('   • Database rules allow write access'));
    }

    throw error;
  }
}
