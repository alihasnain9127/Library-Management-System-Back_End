import mongoose from 'mongoose';
import { config } from './environment.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoose.url)

  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};