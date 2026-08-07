import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { connectDB } from './db/db';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import lessonRoutes from './routes/lessonRoutes';
import newLessonRoutes from './routes/newLessonRoutes';
import attemptsRoutes from './routes/attemptsRoutes';
import progressRoutes from './routes/progressRoutes';
import reviewRoutes from './routes/reviewRoutes';
import resourceRoutes from './routes/resourceRoute';
import pronunciationRoutes from './routes/pronunciationRoutes';
//import galleryRoutes from './routes/galleryRoutes';

import mongoose from "mongoose";
import { Lesson } from "./models/Lesson";
import { warmPhonemeRecognizer } from "./services/phonemeRecognizer";

dotenv.config({ path: './.env' });

const app = express();

app.use(cors({
  origin: true, // reflect request origin
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
}));

app.use(bodyParser.json());

// Connect DB
connectDB()
  .then(() => console.log('Database connected'))
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });

// Root endpoint
app.get('/home', (_req: Request, res: Response) => {
  res.send('Welcome to the AI Model API');
});

// Centralized API routing
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/newlessons', newLessonRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/pronunciation', pronunciationRoutes);
//app.use('/api/gallery', galleryRoutes);

// Fire-and-forget: loads the phoneme model into memory now instead of on
// the first /api/pronunciation/check request.
warmPhonemeRecognizer();

app.get("/debug/lessons", async (_req, res) => {
  const dbName = mongoose.connection.db?.databaseName;
  const count = await Lesson.countDocuments();
  const activeCount = await Lesson.countDocuments({ isActive: true });
  res.json({ dbName, count, activeCount });
});

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res
    .status(err?.status || 500)
    .json({ error: err?.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);