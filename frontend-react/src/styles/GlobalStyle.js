import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f8f9fa;
  }

  button {
    cursor: pointer;
    font-family: inherit;
  }

  ul {
    list-style: none;
  }

  a {
    text-decoration: none;
    color: #007bff;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 500;
    line-height: 1.2;
    margin-bottom: 0.5em;
  }

  p {
    margin-bottom: 1em;
  }

  /* Utility classes */
  .text-center {
    text-align: center;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 15px;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  ::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #666;
  }
`;

export default GlobalStyle; 