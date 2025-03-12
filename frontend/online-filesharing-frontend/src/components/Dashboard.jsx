import React, { useEffect, useState } from "react";
import useStore from "../store";
import API_BASE_URL from "../config";
import { FaStar } from "react-icons/fa";  // ⭐ Star Icon

const INACTIVITY_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

const Dashboard = () => {
  const { user, token, files, addFile, sharedFiles, fetchFiles, removeFile, downloadFile, deleteFile, shareFile, generatePublicLink, fetchSharedFiles, removeSharedFile, sortFiles, searchFiles, toggleStarredFile, logout } = useStore();
  const [selectedFile, setSelectedFile] = useState(null);
  const [shareEmails, setShareEmails] = useState({}); // Store emails for sharing
  const [publicLinks, setPublicLinks] = useState({});
  const [expiryTimes, setExpiryTimes] = useState({});
  const [loadingShare, setLoadingShare] = useState({}); // Track sharing in progress
  const [loadingLink, setLoadingLink] = useState({}); // Track link generation in progress
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [showFiles, setShowFiles] = useState(true);
  const [showSharedFiles, setShowSharedFiles] = useState(true);
  const [showStarredFiles, setShowStarredFiles] = useState(true);

  const [fileViewMode, setFileViewMode] = useState("grid");
  const [sharedFileViewMode, setSharedFileViewMode] = useState("grid");
  const [starredFileViewMode, setStarredFileViewMode] = useState("grid");

  let inactivityTimer;

  // Function to reset inactivity timer
  const resetTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);

    inactivityTimer = setTimeout(() => {
      logout();
      alert("You have been logged out due to inactivity.");
    }, INACTIVITY_TIMEOUT);
  };

  // Detect user activity and reset timer
  useEffect(() => {
    if (!token) return;

    // Reset the timer on any of these events
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);

    // Start the initial timer
    resetTimer();

    // Cleanup event listeners when component unmounts
    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
    };
  }, [token, logout]);

  // Fetch files when the component mounts
  useEffect(() => {
    if (token) {
      fetchFiles(token);
    }
  }, [token, fetchFiles]);

  useEffect(() => {
    if (token) {
      fetchFiles(token);
      fetchSharedFiles(token); // Fetch shared files
    }
  }, [token, fetchFiles, fetchSharedFiles]);

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      addFile({ id: data.file_id, filename: selectedFile.name, s3_url: data.file_url });
      setSelectedFile(null);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file sharing
  const handleShare = async (fileId) => {
    const email = shareEmails[fileId]?.trim();
    if (!email) {
      alert("Please enter an email to share.");
      return;
    }

    setLoadingShare((prev) => ({ ...prev, [fileId]: true }));
    console.log(`Attempting to share file ${fileId} with ${email}...`);

    const success = await shareFile(fileId, email, token);
    setLoadingShare((prev) => ({ ...prev, [fileId]: false }));

    if (success) {
      alert(`File shared with ${email}`);
      setShareEmails((prev) => ({ ...prev, [fileId]: "" })); // Clear input after sharing
    } else {
      alert("File sharing failed. Please try again.");
    }
  };

  // Handle public link generation
  const handleGenerateLink = async (fileId) => {
    const expiryMinutes = expiryTimes[fileId] || 60; // Default to 60 minutes if not set

    setLoadingLink((prev) => ({ ...prev, [fileId]: true }));
    console.log(`Generating public link for file ${fileId} with expiry: ${expiryMinutes} minutes`);

    const publicUrl = await generatePublicLink(fileId, expiryMinutes, token);
    setLoadingLink((prev) => ({ ...prev, [fileId]: false }));

    if (publicUrl) {
      setPublicLinks((prev) => ({ ...prev, [fileId]: publicUrl }));
    } else {
      alert("Failed to generate public link. Please try again.");
    }
  };

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "token" && !event.newValue) {
        logout();
      }
    };
  
    window.addEventListener("storage", handleStorageChange);
  
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [logout]);

  return (
    <div className="p-6 w-[100vw] mx-auto flex flex-col justify-between">
      <div className="w-[100%] bg-gray-100 flex justify-between items-center p-4">
        <h1 className="text-3xl font-bold text-blue-600">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <p className="text-lg text-gray-800">Welcome, {user?.email || "Guest"}</p>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
      {/* Search & Sorting Controls */}
      <div className="mt-4 flex justify-between items-center flex-col">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search in Drive"
          value={searchQuery}
          onChange={(e) => {
            const query = e.target.value;
            setSearchQuery(query);
            searchFiles(query);
          }}
          onBlur={() => {
            if (!searchQuery.trim()) {
              fetchFiles(token);
              fetchSharedFiles(token); // ✅ Ensure both lists reset when search is cleared
            }
          }}
          className="border p-2 rounded-md w-2/3"
        />
        <div className="m-5 flex flex-row w-[100%] items-center justify-center">
          {/* Filter Dropdown */}
          <select
            onChange={(e) => fetchFiles(token, sortBy, e.target.value)}
            className="border p-2 rounded-md w-[15%] mx-2"
          >
            <option value="">All Files</option>
            <option value="uploaded">Uploaded Files</option>
            <option value="shared">Shared Files</option>
          </select>

          {/* Sorting Dropdown */}
          <select
            onChange={(e) => sortFiles(e.target.value)}
            className="border p-2 rounded-md w-[15%] mx-2"
          >
            <option value="newest">Newest</option>
            <option value="alphabetical">A-Z</option>
          </select>

        </div>
      </div>

      {/* File Upload */}
      <div className="mt-6 flex flex-col items-center">
        <input type="file" onChange={(e) => setSelectedFile(e.target.files[0])} className="border p-2 rounded-md" />
        {/* Upload Button */}
        <button
          onClick={handleUpload}
          className={`mt-4 px-6 py-2 text-white rounded-md ${isUploading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}
          disabled={isUploading} // Disable button when uploading
        >
          {isUploading ? (
            <span className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"></circle>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 0116 0H4z"></path>
              </svg>
              Uploading...
            </span>
          ) : "Upload File"}
        </button>
      </div>

      {/* File List */}
      <div className="mt-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-100">📂 Your Files</h2>
          <div className="flex space-x-3">
            {/* Toggle View Mode Button */}
            <button
              onClick={() => setFileViewMode(fileViewMode === "grid" ? "list" : "grid")}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {fileViewMode === "grid" ? "📃 List View" : "🔲 Grid View"}
            </button>

            {/* Expand/Collapse Button */}
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {showFiles ? "⬆ Collapse" : "⬇ Expand"}
            </button>
          </div>
        </div>

        {showFiles && (
          files.length === 0 ? (
            <p className="mt-2 text-gray-500 text-center">No files uploaded yet.</p>
          ) : (
            <div className={fileViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col space-y-3"}>
              {files.map((file) => (
                <div key={file.id} className="bg-gray-500 p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex flex-col">
                  {/* File Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => toggleStarredFile(file.id, token)}>
                        <FaStar color={file.starred ? "gold" : "white"} size={15} className="hover:scale-110 transition-all" />
                      </button>
                      <a href={file.s3_url} target="_blank" rel="noopener noreferrer" className=" font-medium hover:underline">
                        <h3 className="text-white">
                        {file.filename}
                        </h3>
                      </a>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex justify-between items-center mt-4">
                    {/* Download & Delete Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => downloadFile(file.id, token)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all"
                      >
                        ⬇ Download
                      </button>
                      <button
                        onClick={() => deleteFile(file.id, token)}
                        className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
                      >
                        ❌ Delete
                      </button>
                    </div>
                  </div>

                  {/* File Sharing Input */}
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="email"
                      placeholder="Enter email to share"
                      value={shareEmails[file.id] || ""}
                      onChange={(e) => setShareEmails((prev) => ({ ...prev, [file.id]: e.target.value }))}
                      className="p-2 border rounded-md flex-1"
                    />
                    <button
                      onClick={() => handleShare(file.id)}
                      className={`px-4 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all ${loadingShare[file.id] ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      disabled={loadingShare[file.id]}
                    >
                      {loadingShare[file.id] ? "Sharing..." : "Share"}
                    </button>
                  </div>

                  {/* Public Link Generation */}
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="number"
                      placeholder="Expiry (mins)"
                      value={expiryTimes[file.id] || ""}
                      onChange={(e) =>
                        setExpiryTimes((prev) => ({ ...prev, [file.id]: e.target.value }))
                      }
                      className="p-2 border rounded-md w-20"
                    />
                    <button
                      onClick={() => handleGenerateLink(file.id)}
                      className={`px-4 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-all ${loadingLink[file.id] ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      disabled={loadingLink[file.id]}
                    >
                      {loadingLink[file.id] ? "Generating..." : "Generate Link"}
                    </button>
                  </div>

                  {/* Show Public Link */}
                  {publicLinks[file.id] && (
                    <div className="mt-2 p-2 bg-gray-200 rounded-md">
                      <p className="text-sm text-gray-700 break-words">{publicLinks[file.id]}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(publicLinks[file.id])}
                        className="mt-1 text-xs text-blue-500 hover:underline"
                      >
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Shared Files Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-100">📂 Shared with You</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setSharedFileViewMode(sharedFileViewMode === "grid" ? "list" : "grid")}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {sharedFileViewMode === "grid" ? "📃 List View" : "🔲 Grid View"}
            </button>
            <button
              onClick={() => setShowSharedFiles(!showSharedFiles)}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {showSharedFiles ? "⬆ Collapse" : "⬇ Expand"}
            </button>
          </div>
        </div>

        {showSharedFiles && (
          sharedFiles.length === 0 ? (
            <p className="mt-2 text-gray-500 text-center">No files shared with you.</p>
          ) : (
            <div className={sharedFileViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col space-y-3"}>
              {sharedFiles.map((file) => (
                <div key={file.id} className="bg-gray-500 p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <a href={file.s3_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 font-medium hover:underline">
                  <h3 className="text-white">
                    {file.filename}
                    </h3>
                  </a>
                  <div className="flex justify-between items-center mt-3">
                    <button
                      onClick={() => downloadFile(file.id, token)}
                      className="px-4 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-all"
                    >
                      ⬇ Download
                    </button>
                    <button
                      onClick={() => removeSharedFile(file.id, token)}
                      className="px-4 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
                    >
                      ❌ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Starred Files Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-yellow-500">⭐ Starred Files</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setStarredFileViewMode(starredFileViewMode === "grid" ? "list" : "grid")}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {starredFileViewMode === "grid" ? "📃 List View" : "🔲 Grid View"}
            </button>
            <button
              onClick={() => setShowStarredFiles(!showStarredFiles)}
              className="px-3 py-1 bg-gray-300 text-gray-100 rounded-md hover:bg-gray-400 transition-all"
            >
              {showStarredFiles ? "⬆ Collapse" : "⬇ Expand"}
            </button>
          </div>
        </div>

        {showStarredFiles && (
          files.filter(file => file.starred).length === 0 ? (
            <p className="mt-2 text-gray-500 text-center">No starred files yet.</p>
          ) : (
            <div className={starredFileViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col space-y-3"}>
              {files.filter(file => file.starred).map((file) => (
                <div key={file.id} className="bg-yellow-50 p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                  <a href={file.s3_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  <h3 className="text-black">
                    {file.filename}
                    </h3>
                  </a>
                  <button onClick={() => toggleStarredFile(file.id, token)} className="mt-3 flex items-center space-x-2">
                    <FaStar color="gold" size={20} className="hover:scale-110 transition-all" />
                    <span className="text-yellow-600">Unstar</span>
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Dashboard;