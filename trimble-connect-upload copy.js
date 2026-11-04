
/**
 * Uploads a file to Trimble Connect, creating a folder structure by date and username.
 * 
 * @param {File} file The file to upload.
 * @param {string} username The username of the person uploading the file.
 * @param {string} accessToken Your Trimble Connect API access token.
 * @param {string} parentFolderId The ID of the root folder to create new folders in.
 */
async function uploadFile(filename, file, username, accessToken, parentFolderId) {
  console.log(`Get filename: '${filename}'`);
  if (!file || !username || !accessToken || !parentFolderId) {
    alert('Please provide a file, username, access token, and parent folder ID.');
    return;
  }

  const today = new Date();
  //const dateFolder = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateFolder = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}_${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}${String(today.getSeconds()).padStart(2, '0')}`;

  try {
    // Step 1: Get or create the date folder.
    console.log(`Step 1: Ensuring folder '${dateFolder}' exists...`);
    const dateFolderId = await getOrCreateFolder(dateFolder, parentFolderId, accessToken);

    // Step 2: Get or create the username folder inside the date folder.
    console.log(`Step 2: Ensuring folder '${username}' exists...`);
    const userFolderId = await getOrCreateFolder(username, dateFolderId, accessToken);
    console.log(`Step 2.1: Get folderId '${userFolderId}'...`);

    // Step 3: Get the signed URL for the file upload inside the user folder.
    console.log('Step 3: Getting upload URL...');
    const uploadUrlData = await getUploadUrl(filename, userFolderId, accessToken);

    if (!uploadUrlData || uploadUrlData.length === 0 || !uploadUrlData[0].uploadUrl) {
        throw new Error('Could not retrieve a valid upload URL from the Trimble Connect API.');
    }
    const uploadUrl = uploadUrlData[0].uploadUrl;

    // Step 4: Upload the file to the signed URL.
    console.log('Step 4: Uploading file...');
    await uploadFileToSignedUrl(uploadUrl, file);

    alert(`File "${file.name}" uploaded successfully to folder: ${dateFolder}/${username}`);

  } catch (error) {
    console.error('Error uploading file:', error);
    alert(`An error occurred during the file upload. Check the console for details. Error: ${error.message}`);
  }
}

/**
 * Gets a folder by name within a parent folder, or creates it if it doesn't exist.
 * @param {string} folderName The name of the folder to get or create.
 * @param {string} parentId The ID of the parent folder.
 * @param {string} accessToken Your Trimble Connect API access token.
 * @returns {Promise<string>} The ID of the folder.
 */
async function getOrCreateFolder(folderName, parentId, accessToken) {
  // First, try to find the folder by listing the parent's children.
  // const listUrl = `https://app31.connect.trimble.com/tc/api/2.0/folders/${parentId}/children`;
  // const listResponse = await fetch(listUrl, {
  //     headers: { 'Authorization': `Bearer ${accessToken}` }
  // });

  // if (!listResponse.ok) {
  //     throw new Error(`API Error: Failed to list folders. Status: ${listResponse.status}`);
  // }

  // const children = await listResponse.json();
  // const existingFolder = children.find(child => child.type === 'FOLDER' && child.name === folderName);

  // if (existingFolder) {
  //     console.log(`Found existing folder '${folderName}' with ID: ${existingFolder.id}`);
  //     return existingFolder.id;
  // }

  // If the folder doesn't exist, create it.
  console.log(`Folder '${folderName}' not found. Creating it...`);
  const createUrl = 'https://app31.connect.trimble.com/tc/api/2.0/folders';
  const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
          name: folderName, 
          parentId: parentId 
      })
  });

  if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`API Error: Failed to create folder. Status: ${createResponse.status} - ${errorText}`);
  }

  const newFolder = await createResponse.json();
  console.log(`Created new folder '${folderName}' with ID: ${newFolder.id}`);
  return newFolder.id;
}

/**
 * Gets a signed URL for uploading a file.
 * @param {File} file The file object to be uploaded.
 * @param {string} parentId The ID of the parent folder.
 * @param {string} accessToken Your Trimble Connect API access token.
 * @returns {Promise<object>} The response from the API, including the uploadUrl.
 */
async function getUploadUrl(filename, parentId, accessToken) {
  const apiUrl = `https://app31.connect.trimble.com/tc/api/2.0/files/fs/upload?parentId=${parentId}&parentType=FOLDER`;
  console.log(`getUploadUrl: Getting upload filename ${filename} ...`);
  console.log(`getUploadUrl: Getting upload URL ${apiUrl} ...`);
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      name: filename
    }])
  });
  console.log(`getUploadUrl: Getting upload URL ${response.text} ...`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Uploads the file content to the provided signed URL.
 * @param {string} uploadUrl The signed URL for the PUT request.
 * @param {File} file The file to upload.
 */
async function uploadFileToSignedUrl(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
        'Content-Type': file.type || 'application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error(`File Upload Error: status: ${response.status}`);
  }
}
