const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const allowedOrigins = [
  
 
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
};

module.exports = cors(corsOptions);