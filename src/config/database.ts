import mongoose from 'mongoose';
import { config } from './environment.js';

export const connectDB = async (): Promise<void> => {
  try {
    // await mongoose.connect(config.mongoose.url)
    await mongoose.connect("mongodb://localhost:27017/library_management_system")

  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};