import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

const app = express();

app.use(cors([
    /http:\/\/localhost:?\d+/i,
    "https://remtori.netlify.app",
    "https://files-remtori.netlify.app",
]));

app.use(morgan('short'));
app.use(express.json());


if (process.env.NODE_ENV !== 'production')
{
    const PORT = process.env.PORT || 4999;
    app.listen(PORT, () => {
        console.log('Server started! Listening at port: ' + PORT);
    });
}
else
{
    module.exports.handler = require('serverless-http')(app);
}