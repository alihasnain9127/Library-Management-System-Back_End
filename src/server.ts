import app from './app.js';
import { config } from './config/environment.js';
import { connectDB } from './config/database.js';


const startServer = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`Server running in ${config.env} mode on port ${config.port}`);
  });
};

startServer();