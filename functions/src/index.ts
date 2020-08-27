import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

import { uploadFileHandler } from './routes/uploadFile';

const PORT = process.env.PORT || 4999;

const app = express();
app.use(cors());
app.use(morgan('short'));
app.use(express.json());

app.use('/uploadFile', uploadFileHandler);

app.listen(PORT, () => {
    console.log('Server started! Listening at port: ' + PORT);
});