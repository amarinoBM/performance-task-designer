# Curriculum Designer Chatbot

A Next.js application demonstrating a step-by-step curriculum design process using LangChain, with server-side processing and a clean Tailwind UI.

## Features

- **Multi-step Curriculum Design Process**: 
  1. Initial thoughts on curriculum topic
  2. Generation of unit ideas based on user input
  3. Selection or improvement of unit ideas
  4. Creation of exercise topics
  5. Final curriculum unit summary

- **Server-side LangChain Implementation**:
  - Structured output parsing with Zod schemas
  - Factory pattern for different chain types
  - Memory management across conversation steps
  - Classification of user intent (accept vs improve)

- **Clean UI**:
  - Simple and focused chat interface
  - Markdown rendering for formatted responses
  - Loading indicators and typing states
  - Topic selection to start the process

## Technical Details

### Architecture

The application uses a factory pattern to create different LangChain chains based on the current step in the curriculum design process. Each step has specialized prompts and output schemas to ensure structured data.

The main components are:

- **Memory**: Stores conversation history and curriculum design state
- **Schemas**: Defines the structure of our data using Zod
- **Chains**: Processes user input and generates structured responses
- **Service**: Orchestrates the flow between different steps

### Data Flow

1. User starts by selecting a curriculum topic
2. The service initializes a conversation with the topic
3. Based on user input, LangChain generates unit ideas
4. User responses are classified to determine next steps
5. The process continues until a complete curriculum unit is designed

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your OpenAI API key in `.env.local`:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technologies Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- Shadcn UI
- LangChain
- OpenAI API
- Zod for validation

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
