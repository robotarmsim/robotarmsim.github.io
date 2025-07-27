// src/components/MarkdownViewer.tsx
import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const MarkdownViewer: React.FC<{ filePath: string }> = ({ filePath }) => {
    const [markdownContent, setMarkdownContent] = useState('');

    useEffect(() => {
        // Fetch the Markdown file
        fetch(filePath)
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then((text) => {
                setMarkdownContent(text);
            })
            .catch((error) => {
                console.error('Error fetching the Markdown file:', error);
            });
    }, [filePath]);

    return (
        <div>
            <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
    );
};

export default MarkdownViewer;
