import { program } from 'commander';

const rtdbProgram = program
  .name('rtdb')
  .description('Realtime Database operations')
  .option('--database-url <url>', 'Firebase Realtime Database URL');

export default rtdbProgram;
