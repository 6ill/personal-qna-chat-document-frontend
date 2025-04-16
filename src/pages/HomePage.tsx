import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

interface Document {
    id: string;
    filename: string;
    fileType: string;
    uploadedAt: string;
}

interface ChatMessage {
    sender: "user" | "bot";
    message: string;
}

const HomePage: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [activeDocument, setActiveDocument] = useState<Document | null>(null);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');
    const token = useSelector((state: RootState) => state.auth.token)

    // Fetch uploaded documents on component mount
    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/v1/documents/list', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDocuments(response.data.documents);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch documents');
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            await axios.post('http://localhost:3000/api/v1/documents/upload', formData, {
                headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`,
                },
            });
            await fetchDocuments();
            setSelectedFile(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Upload failed');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.post(
                "http://localhost:3000/api/v1/documents/delete",
                { id },
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            // If the deleted document is the currently active one, clear activeDocument
            if (activeDocument && activeDocument.id === id) {
                setActiveDocument(null);
                setChatHistory([]);
            }
            await fetchDocuments();
        } catch (err: any) {
            setError(err.response?.data?.message || "Delete failed");
        }
    };

    const handleDocumentSelect = (doc: Document) => {
        setActiveDocument(doc);
        // Clear previous chat history when switching files.
        setChatHistory([]);
    };

    const handleChatSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!activeDocument || chatInput.trim() === "") return;

        // Add user's message to chat history
        setChatHistory((prev) => [
            ...prev,
            { sender: "user", message: chatInput },
        ]);

        // Clear previous error if any
        setError("");

        try {
            // Make a POST request to the streaming endpoint
            const response = await fetch(
                "http://localhost:3000/api/v1/chats/stream",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        documentId: activeDocument.id,
                        query: chatInput,
                    }),
                }
            );

            if (!response.ok || !response.body) {
                console.log(response)
                throw new Error(`Failed to stream chat response`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botMessage = "";

            // Optionally, add an initial empty bot message to the history
            setChatHistory((prev) => [...prev, { sender: "bot", message: "" }]);

            // Continuously read stream data
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                console.log("isi chunk: ", chunk)
                botMessage += chunk;
                // Update the last message in the chat history with the accumulating response
                setChatHistory((prev) => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    if (lastIndex >= 0 && updated[lastIndex].sender === "bot") {
                        updated[lastIndex].message = botMessage;
                    }
                    return updated;
                });
            }
            // Clear chat input after the stream ends
            setChatInput("");
        } catch (err: any) {
            setError(err.message || "Streaming chat failed");
        }
    };

    return (
        <div style={{ display: "flex", height: "100vh" }}>
            {/* Sidebar for documents and upload */}
            <div
                style={{
                    width: "250px",
                    borderRight: "1px solid #ccc",
                    padding: "1rem",
                    overflowY: "auto",
                }}
            >
                <h3>Documents</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {documents.map((doc) => (
                        <li
                            key={doc.id}
                            style={{
                                marginBottom: "0.5rem",
                                cursor: "pointer",
                                backgroundColor:
                                    activeDocument?.id === doc.id
                                        ? "#eef"
                                        : "transparent",
                                padding: "0.25rem",
                            }}
                            onClick={() => handleDocumentSelect(doc)}
                        >
                            <span>{doc.filename}</span>
                            <button
                                style={{ marginLeft: "0.5rem" }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(doc.id);
                                }}
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
                <div style={{ marginTop: "2rem" }}>
                    <h4>Upload New Document</h4>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                    />
                    <button
                        style={{ display: "block", marginTop: "1rem" }}
                        onClick={handleUpload}
                        disabled={!selectedFile}
                    >
                        Upload
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                style={{
                    flex: 1,
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <h2>Chat Q&A</h2>
                {activeDocument ? (
                    <>
                        <p>
                            Chatting about:{" "}
                            <strong>{activeDocument.filename}</strong>
                        </p>
                        <div
                            style={{
                                flex: 1,
                                border: "1px solid #ccc",
                                marginBottom: "1rem",
                                padding: "0.5rem",
                                overflowY: "auto",
                            }}
                        >
                            {chatHistory.map((chat, index) => (
                                <div
                                    key={index}
                                    style={{
                                        textAlign:
                                            chat.sender === "user"
                                                ? "right"
                                                : "left",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    <span
                                        style={{
                                            backgroundColor:
                                                chat.sender === "user"
                                                    ? "#381E59"
                                                    : "#7E45C9",
                                            padding: "0.2rem",
                                            borderRadius: "5px",
                                        }}
                                    >
                                        {chat.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <form
                            onSubmit={handleChatSubmit}
                            style={{ display: "flex" }}
                        >
                            <input
                                type="text"
                                value={chatInput}
                                placeholder="Type your question here..."
                                onChange={(e) => setChatInput(e.target.value)}
                                style={{ flex: 1, padding: "0.5rem" }}
                                maxLength={600}
                            />
                            <button
                                type="submit"
                                style={{ padding: "0.5rem 1rem" }}
                            >
                                Send
                            </button>
                        </form>
                    </>
                ) : (
                    documents.length > 0 ? (
                        <p>Please select a document to start chatting.</p>) : (
                        <p>No documents uploaded yet. Please upload a document to start chatting.</p>
                ))}
            </div>

            {error && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        backgroundColor: "#fdd",
                        color: "#900",
                        textAlign: "center",
                        padding: "0.5rem",
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );
};

export default HomePage;
