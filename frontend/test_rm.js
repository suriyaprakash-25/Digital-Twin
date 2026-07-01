import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

try {
  const html = renderToString(React.createElement(ReactMarkdown, null, "Hello **world**"));
  console.log("SUCCESS:", html);
} catch (error) {
  console.error("ERROR:", error);
}
