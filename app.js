const stream = require("stream");
const express = require("express");
const multer = require("multer");
const path = require("path");
const { google } = require("googleapis");
const fs = require("fs");
const app = express();
const upload = multer();

const { exec } = require('child_process');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const KEYFILEPATH = path.join(__dirname, "cred.json");
const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

// Log function to write logs to both console and file
const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(path.join(__dirname, 'app_logs.txt'), logMessage);
};

const uploadFile = async (filePath, retries = 3, delay = 1000) => {
    const fileObject = fs.readFileSync(filePath);
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject);

    const fileName = path.basename(filePath);
    const mimeType = fileObject.mimeType;

    for (let attempt = 1; attempt < retries; attempt++) {
        try {
            const { data } = await google.drive({ version: "v3", auth }).files.create({
                media: {
                mimeType: mimeType,
                body: bufferStream,
                },
                requestBody: {
                name: fileName,
                parents: ["1cbWzZPT6OO7uHkABRSZDgB9CdFNoPWWR"], // Update to your folder ID
                },
                fields: "id,name",
            });
        
            logToFile(`Uploaded file ${data.name} ${data.id}`);

            // Delete the file after successful upload
            fs.unlink(filePath, (err) => {
                if (err) {
                logToFile(`Failed to delete file ${filePath}`, err);
            } else {
                logToFile(`Deleted file ${filePath}`);
                backupCallback();
                }
            });
        } catch (error) {
            if (attempt < retries) {
                console.log(error)
                logToFile(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                logToFile(`Failed to upload file after ${retries} attempts`, error);
            }
        }
    }
};

const readAndUploadFiles = async (directoryPath) => {
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            logToFile(`Could not list the directory.`, err);
            return;
        }
        
        if(files.length === 0){
            logToFile(`The directory ${directoryPath} is empty.`);
        }
    
        files.forEach(async (file) => {
            const filePath = path.join(directoryPath, file);
            await uploadFile(filePath);
        });
    });
};

function backupCallback() {
    console.log("Callback executed");

    exec('node example.js', (error, stdout, stderr) => {
        if (error) {
        console.error(`Error executing callback: ${error.message}`);
        return;
        }

        if (stderr) {
        console.error(`callback error output: ${stderr}`);
        return;
        }

        console.log(`callback output:\n${stdout}`);
    });
}

readAndUploadFiles("./images");
