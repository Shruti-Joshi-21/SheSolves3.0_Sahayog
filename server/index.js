require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/worker', require('./routes/workerRoutes'));
app.use('/api/teamlead', require('./routes/teamleadRoutes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/leave', require('./routes/leaveRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use('/api/locations', require('./routes/location.routes'));
app.use('/api/tasks', require('./routes/task.routes'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
