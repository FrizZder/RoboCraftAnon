# Anonymizer App

A desktop application for offline text, image, and document anonymization with a ChatGPT/Telegram-like interface.

## Features

- 🛡️ Offline text anonymization
- 📷 Image anonymization with face detection
- 📄 PDF document anonymization
- 💬 Chat-like interface
- 🌙 Dark mode by default
- 🌐 Multi-language support (English/Russian)
- ⚙️ Customizable settings

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd anonymizer-app
```

2. Install dependencies:

```bash
npm install
```

3. Start the application:

```bash
npm start
```

For development with DevTools:

```bash
npm run dev
```

## Building

To build the application for your platform:

```bash
npm run build
```

## Usage

1. Launch the application
2. Type text or drag files into the input area
3. The anonymized results will appear in the chat interface
4. Use the settings panel (⚙️) to configure:
   - Output directory
   - Language
   - Anonymization level

## Security

- All processing is done locally
- No data is sent to external servers
- Files are processed in memory and not stored unless explicitly saved

## License

MIT
