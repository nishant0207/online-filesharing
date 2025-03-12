import { create } from "zustand";
import API_BASE_URL from "./config";

const useStore = create((set) => ({
  user: JSON.parse(sessionStorage.getItem("user")) || null,
  token: sessionStorage.getItem("token") || null,
  files: [], // Ensure files is always an array
  allFiles: [],
  sharedFiles: [],
  allSharedFiles: [],

  // Fix: Send JSON format (instead of URLSearchParams)
  login: async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,   // Ensure correct field names match backend
          password: password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Invalid credentials");
      }

      const data = await response.json();
      const user = {email};

       // ✅ Store user & token in localStorage
       sessionStorage.setItem("user", JSON.stringify(user));
       sessionStorage.setItem("token", data.access_token);   
      
      
      set({ user: { email }, token: data.access_token });
    } catch (error) {
      console.error("Login failed:", error.message);
    }
  },

  // Signup (No Changes Needed)
  signup: async (username, email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) throw new Error("Signup failed");

      return true;
    } catch (error) {
      console.error("Signup failed:", error.message);
      return false;
    }
  },

  logout: () => {
    // ✅ Clear user data from localStorage
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");

    set({ user: null, token: null, files: [] });
    window.location.reload();
  },

  // Fetch files from backend API
  fetchFiles: async (token, sortBy = "newest", filterBy = null) => {
    try {
      const url = new URL(`${API_BASE_URL}/files`);
      url.searchParams.append("sort_by", sortBy);
      if (filterBy) url.searchParams.append("filter_by", filterBy);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch files");

      const data = await response.json();
      set({files: data,allFiles: data});
      set({ files: data });
    } catch (error) {
      console.error("Error fetching files:", error.message);
    }
  },

  addFile: (file) =>
    set((state) => ({ files: [...state.files, file] })),

  removeFile: (fileId) =>
    set((state) => ({ files: state.files.filter((file) => file.id !== fileId) })),

  downloadFile: async (fileId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/download/${fileId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to generate download link");

      const data = await response.json();
      window.open(data.download_url, "_blank"); // Open the link in a new tab
    } catch (error) {
      console.error("Error downloading file:", error.message);
    }
  },

  deleteFile: async (fileId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to delete file");

      set((state) => ({
        files: state.files.filter((file) => file.id !== fileId),
      })); // Remove file from state

    } catch (error) {
      console.error("Error deleting file:", error.message);
    }
  },

  shareFile: async (fileId, sharedWithEmail, token) => {
    console.log(`Calling API to share file ${fileId} with ${sharedWithEmail}...`);

    try {
      const response = await fetch(`${API_BASE_URL}/share/${fileId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shared_with_email: sharedWithEmail }),
      });

      console.log("Response received:", response);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error from API:", errorData);
        throw new Error(errorData.detail || "Failed to share file");
      }

      console.log(`File successfully shared with ${sharedWithEmail}`);
      return true;
    } catch (error) {
      console.error("Error sharing file:", error.message);
      return false;
    }
  },

  generatePublicLink: async (fileId, expiryMinutes, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/public-link/${fileId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiry_minutes: expiryMinutes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate public link");
      }

      const data = await response.json();
      console.log(`Public link generated: ${data.public_url}`);
      return data.public_url;
    } catch (error) {
      console.error("Error generating public link:", error.message);
      return null;
    }
  },

  fetchSharedFiles: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/shared-files`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch shared files");

      const data = await response.json();
      set({ sharedFiles: data, allSharedFiles: data }); // ✅ Store full shared files list
    } catch (error) {
      console.error("Error fetching shared files:", error.message);
      set({ sharedFiles: [] }); // ✅ Prevent undefined errors
    }
  },

  removeSharedFile: async (fileId, token) => {
    console.log(`Attempting to remove shared file: ${fileId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/shared-files/${String(fileId)}`, {  // ✅ Convert to string
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Response received:", response);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error from API:", errorData);
        throw new Error(errorData.detail || "Failed to remove shared file");
      }

      console.log(`Successfully removed shared file: ${fileId}`);

      // Remove file from state after successful deletion
      set((state) => ({
        sharedFiles: state.sharedFiles.filter((file) => file.id !== fileId),
      }));

    } catch (error) {
      console.error("Error removing shared file:", error.message);
    }
  },

  sortFiles: (type) => {
    set((state) => {
      let sortedFiles = [...state.files];

      if (type === "newest") {
        sortedFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (type === "alphabetical") {
        sortedFiles.sort((a, b) => a.filename.localeCompare(b.filename));
      }

      return { files: sortedFiles };
    });
  },

  searchFiles: (query) => {
    set((state) => {
      if (!query.trim()) {
        return { files: state.allFiles, sharedFiles: state.allSharedFiles }; // ✅ Reset to full list if query is empty
      }

      const filteredFiles = state.allFiles.filter((file) =>
        file.filename.toLowerCase().includes(query.toLowerCase())
      );

      const filteredSharedFiles = state.allSharedFiles.filter((file) =>
        file.filename.toLowerCase().includes(query.toLowerCase())
      );

      return { files: filteredFiles, sharedFiles: filteredSharedFiles };
    });
  },

  toggleStarredFile: async (fileId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/star`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Failed to toggle star status");

    set((state) => ({
      files: state.files.map((file) =>
        file.id === fileId ? { ...file, starred: !file.starred } : file
      ),
    }));
  } catch (error) {
    console.error("Error starring file:", error.message);
  }
},
  
}));

export default useStore;