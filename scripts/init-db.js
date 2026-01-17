import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function initDatabase() {
  console.log('Initializing AJC PISOWIFI database...');
  
  try {
    // Run the TypeScript database initialization
    await execAsync('node --import tsx/esm api/database/init.ts');
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();