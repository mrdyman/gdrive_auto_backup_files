const stream = require("stream");
const path = require("path");
const { google } = require("googleapis");
const fs = require("fs");

const { exec } = require('child_process');

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
                parents: ["1GdCq1h9w5vXArLhsCO3tREQmojRH2Ure"], // Update to your folder ID
                },
                fields: "id,name",
            });
        
            logToFile(`Uploaded file ${data.name} ${data.id}`);

        // Delete the file after successful upload
        try {
            await fs.promises.unlink(filePath);
            logToFile(`Deleted file ${filePath}`);
        } catch (unlinkError) {
            logToFile(`Failed to delete file ${filePath}`, unlinkError);
        }
        return; // Exit after successful upload and delete
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
    try {
        const files = await fs.promises.readdir(directoryPath);

        if (files.length === 0) {
            logToFile(`The directory ${directoryPath} is empty.`);
        } else {
            const uploadPromises = files.map(async (file) => {
                const filePath = path.join(directoryPath, file);
                await uploadFile(filePath);
            });

            await Promise.all(uploadPromises);
            logToFile(`All files have been uploaded.`);
        }
    } catch (err) {
        logToFile(`Could not list the directory.`, err);
    } finally {
        console.log('Exiting process...');
        process.exit(); // Exit app after backup completed
    }
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
