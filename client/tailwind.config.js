import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        path.resolve(__dirname, './index.html'),
        path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
    ],
    theme: {
        extend: {
            colors: {
                primary: "#005F02",
                "primary-light": "#427A43",
                accent: "#C0B87A",
                "bg-cream": "#F2E3BB",
            }
        },
    },
    plugins: [],
}
