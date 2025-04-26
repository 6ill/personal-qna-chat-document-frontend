import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import LogoutButton from '../components/LogoutButton';
import ReactMarkdown from 'react-markdown';
import { SERVER_URL } from '../utils/api';

interface Document {
    id: string;
    filename: string;
    fileType: string;
    uploadedAt: string;
}

interface ChatMessage {
    creator: "user" | "bot";
    content: string;
}

const HomePage: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [activeDocument, setActiveDocument] = useState<Document | null>(null);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');
    const token = useSelector((state: RootState) => state.auth.token)
    console.log(SERVER_URL)
    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const response = await axios.get(`${SERVER_URL}/documents/list`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDocuments(response.data.documents);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch documents');
        }
    };

    const fetchMessages = async (documentId:string) => {
        try {
            if(documentId === '') return;
            const response = await axios.get(
                `${SERVER_URL}/chats/${documentId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setChatHistory(response.data.messages)
        } catch (err:any) {
            setError(err.response?.data?.message || 'Failed to fetch messages');
        }
    }

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

            await axios.post(`${SERVER_URL}/documents/upload`, formData, {
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
                `${SERVER_URL}/documents/delete`,
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

    const handleDocumentSelect = async (doc: Document) => {
        setActiveDocument(doc);
        await fetchMessages(doc.id);
    };

    const handleChatSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!activeDocument || chatInput.trim() === "") return;

        // Add user's message to chat history
        setChatHistory((prev) => [
            ...prev,
            { creator: "user", content: chatInput },
        ]);

        // Clear previous error if any
        setError("");

        try {
            // Make a POST request to the streaming endpoint
            const response = await fetch(
                `${SERVER_URL}/chats/stream`,
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
            setChatHistory((prev) => [...prev, { creator: "bot", content: "" }]);

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
                    if (lastIndex >= 0 && updated[lastIndex].creator === "bot") {
                        updated[lastIndex].content = botMessage;
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
        <div className="home-container">
            {/* Sidebar */}
            <div className="sidebar">
                <LogoutButton />
                <h3>Documents</h3>
                <ul>
                    {documents.map((doc) => (
                        <li
                            key={doc.id}
                            className={
                                activeDocument?.id === doc.id ? "active" : ""
                            }
                            onClick={() => handleDocumentSelect(doc)}
                        >
                            {doc.filename}
                            <button
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
                <div>
                    <h4>Upload New Document</h4>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                    />
                    <button onClick={handleUpload} disabled={!selectedFile}>
                        Upload
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="main-chat">
                <h2>Chat Q&A</h2>
                {activeDocument ? (
                    <>
                        <div className="chat-header">
                            <p>
                                Chatting about:{" "}
                                <strong>{activeDocument.filename}</strong>
                            </p>
                        </div>
                        <div className="chat-messages">
                            {chatHistory.map((chat, index) => (
                                <div
                                    key={index}
                                    className={`chat-message ${chat.creator}`}
                                >
                                    {chat.creator === "bot" ? (
                                        <ReactMarkdown>
                                            {chat.content}
                                        </ReactMarkdown>
                                    ) : (
                                        chat.content
                                    )}
                                </div>
                            ))}
                        </div>
                        <form
                            onSubmit={handleChatSubmit}
                            className="chat-input-container"
                        >
                            <input
                                type="text"
                                value={chatInput}
                                placeholder="Type your question here..."
                                onChange={(e) => setChatInput(e.target.value)}
                                maxLength={600}
                            />
                            <button type="submit">Send</button>
                        </form>
                    </>
                ) : documents.length > 0 ? (
                    <p>Please select a document to start chatting.</p>
                ) : (
                    <p>
                        No documents uploaded yet. Please upload a document to
                        start chatting.
                    </p>
                )}
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
