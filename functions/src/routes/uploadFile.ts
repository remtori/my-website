import { Request, Response, Router } from 'express';
import fileUpload from 'express-fileupload';

export const uploadFileHandler = Router();

uploadFileHandler.post(
    '/',
    fileUpload({
        useTempFiles: true,
        tempFileDir: './files',
    }),
    (req: Request, res: Response) => {
        console.log(req.files);
        console.log(req.body);
        res.send("Ok!");
    }
);