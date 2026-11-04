
# Project Blueprint: Trimble Connect File Uploader

## 1. Overview

This project provides a web-based interface for uploading files to a Trimble Connect project. It is designed to be a simple, framework-less application that can be easily configured and used for direct file uploads.

The core functionality of this application is to:

1.  **Authenticate** with the Trimble Connect API using a provided access token.
2.  **Select a file** from the user's local machine.
3.  **Create a unique folder structure** on Trimble Connect based on the current date, time, and the user's name.
4.  **Upload the selected file** to the newly created folder.
5.  **Provide feedback** to the user on the success or failure of the upload.

## 2. Features Implemented

*   **Dynamic Folder Creation**: The application automatically generates a unique folder path for each upload to prevent naming conflicts and organize files chronologically. The folder structure is `YYYY-MM-DD_HHMMSS/<username>/`.

*   **Safe Folder Creation**: Before creating a new folder, the application first checks if a folder with the same name already exists in the target directory. If it does, the existing folder is used; otherwise, a new one is created. This prevents "DUPLICATE_NAME" errors from the Trimble Connect API.

*   **Robust Error Handling**: The application includes error handling to gracefully manage issues such as:
    *   Missing or invalid API credentials.
    *   Network failures during API calls.
    *   API errors from Trimble Connect (e.g., bad requests, unauthorized access).

*   **User-Friendly Interface**: A simple HTML interface allows users to:
    *   Enter their username, API access token, and a parent folder ID.
    *   Select a file for upload.
    *   View the name of the selected file before uploading.
    *   Receive a clear success or failure message after the upload attempt.

## 3. Project Structure

The project consists of two main files:

*   `upload-test.html`: This file provides the user interface for the application. It includes input fields for the required credentials, a file selector, and a button to initiate the upload. It also contains the client-side JavaScript to handle user interactions and display the selected filename.

*   `trimble-connect-upload.js`: This file contains the core logic for interacting with the Trimble Connect API. It exports a single function, `uploadFile`, which orchestrates the entire upload process, including folder creation and the final file upload.
