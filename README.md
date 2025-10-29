# AIMinder Flow - AI-Driven Employee Management System

An intelligent task management and employee tracking platform powered by AI. Manage your entire organization through natural conversation with an AI assistant.

## 🌟 Key Features

### For Administrators
- 📊 **Comprehensive Dashboard** - Real-time analytics, performance metrics, and team insights
- 👥 **Employee Management** - Track skills, performance, workload, and availability
- 📈 **Performance Analytics** - Department productivity, top performers, workload balance
- 💰 **Payment Management** - Compare actual vs AI-estimated compensation

### For Employees
- 📬 **Task Inbox** - Receive, accept, or reject task invitations
- ✅ **Task Management** - Update progress, log hours, submit work
- 📊 **Performance Tracking** - View your metrics and completed tasks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Supabase Account

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd aiminder-flow

# Install dependencies
bun install

# Set up environment variables
# Create .env.local with your Supabase credentials

# Run database migrations
supabase db push

# Start development server
bun run dev
```

## 🔑 Default Credentials

**Admin Account:**
- Email: `admin@gmail.com`
- Password: `123456`

## 📖 Documentation

See `IMPLEMENTATION_GUIDE.md` for detailed technical documentation, implementation status, and development guide.

## 🛠️ Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + Shadcn UI
- Supabase (PostgreSQL + Edge Functions)
- OpenAI GPT
- React Query (TanStack Query)

## Project info

**URL**: https://lovable.dev/projects/d221582e-ab22-4482-b443-268c15e7c8c7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d221582e-ab22-4482-b443-268c15e7c8c7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d221582e-ab22-4482-b443-268c15e7c8c7) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
