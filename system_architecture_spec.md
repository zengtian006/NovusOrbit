# NovusOrbit System Architecture Specification

## System Overview

**Platform**: Multi-agent AI career platform with RAG-powered personalization
**Architecture Pattern**: Microservices with API Gateway
**Deployment**: Docker containerized services with Next.js frontend and FastAPI backend

---

## High-Level Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  Next.js 16 + React 19 (Port 3782)                          │
│  - App Router                                                │
│  - Server Components                                         │
│  - Auth.js v5 (OAuth)                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                      API GATEWAY                             │
│  Next.js API Routes (/api/*)                                │
│  - Authentication Middleware                                 │
│  - Request Validation                                        │
│  - Proxy to Backend Services                                │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                    BACKEND SERVICES                          │
│  FastAPI Python Backend (Port 8001)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Agent Orchestration Layer                           │  │
│  │  - Chat Agent                                        │  │
│  │  - Edit Agent                                        │  │
│  │  - Interview Agent                                   │  │
│  │  - Job Suggest Agent                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Layer                                          │  │
│  │  - RAG Tool (Vector Search)                          │  │
│  │  - Web Search Tool                                   │  │
│  │  - Text Analysis Tool                                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Service Layer                                       │  │
│  │  - Portfolio Service                                 │  │
│  │  - Knowledge Base Service                            │  │
│  │  - Session Management Service                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────┬────────────────────────┬─────────────────────┘
              │                        │
     ┌────────▼────────┐     ┌────────▼─────────┐
     │   MongoDB       │     │  Vector Database │
     │   (Prisma)      │     │  (Embeddings)    │
     │                 │     │                  │
     │  - Users        │     │  - Documents     │
     │  - Sessions     │     │  - Portfolios    │
     │  - Jobs         │     │  - Chunks        │
     │  - Portfolios   │     │                  │
     └─────────────────┘     └──────────────────┘
```

---

## Component Specifications

### 1. Frontend Layer (Next.js)

**Technology**: Next.js 16, React 19, TypeScript, Tailwind CSS

**Directory Structure**:
```
web/
├── app/                    # App Router pages
│   ├── (auth)/            # Auth group routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API route handlers
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utilities
│   ├── auth.ts           # Auth.js configuration
│   └── api-client.ts     # Backend API client
├── prisma/               # Prisma schema
└── middleware.ts         # Auth middleware
```

**Key Routes**:
```typescript
// Public Routes
/                          // Landing page
/auth/signin              // Sign in page
/auth/error               // Auth error page

// Protected Routes (requires authentication)
/dashboard                // Main dashboard
/chat                     // Career chat interface
/interview                // Interview prep
/jobs                     // Job board & matching
/resume-writer            // Resume editing
/portfolio                // Career portfolio management
```

**Authentication Flow**:
```typescript
// lib/auth.ts
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  trustHost: true,  // Required for localhost
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store user ID in token
      if (account) {
        token.userId = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      // Add user ID to session
      session.user.id = token.userId
      return session
    }
  }
}
```

**API Client Pattern**:
```typescript
// lib/api-client.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

export async function fetchFromBackend(
  endpoint: string, 
  options?: RequestInit
) {
  const session = await getServerSession(authOptions)
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.user?.id}`,
      ...options?.headers,
    },
  })
  
  return response.json()
}
```

---

### 2. Backend Layer (FastAPI)

**Technology**: Python 3.12, FastAPI, Pydantic, LangChain

**Directory Structure**:
```
src/
├── agents/                  # Agent implementations
│   ├── base_agent.py       # Abstract base agent
│   ├── chat_agent.py       # Career chat agent
│   ├── edit_agent.py       # Resume editing agent
│   ├── interview_agent.py  # Interview prep agent
│   └── job_agent.py        # Job matching agent
├── tools/                   # Tool implementations
│   ├── rag_tool.py         # RAG retrieval tool
│   ├── web_search_tool.py  # Web search tool
│   └── text_tool.py        # Text analysis tool
├── services/                # Business logic services
│   ├── portfolio.py        # Portfolio management
│   ├── knowledge.py        # Knowledge base operations
│   └── session.py          # Session management
├── api/                     # API routes
│   ├── chat.py             # Chat endpoints
│   ├── portfolio.py        # Portfolio endpoints
│   ├── interview.py        # Interview endpoints
│   └── jobs.py             # Job endpoints
├── core/                    # Core utilities
│   ├── config.py           # Configuration
│   └── database.py         # Database connections
└── main.py                  # FastAPI application
```

**Agent Base Class**:
```python
# src/agents/base_agent.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from langchain.llms import BaseLLM
from langchain.tools import BaseTool

class BaseAgent(ABC):
    """Abstract base class for all agents"""
    
    def __init__(
        self,
        llm: BaseLLM,
        tools: Optional[List[BaseTool]] = None,
        system_prompt: str = "",
    ):
        self.llm = llm
        self.tools = tools or []
        self.system_prompt = system_prompt
    
    @abstractmethod
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent logic"""
        pass
    
    def add_tool(self, tool: BaseTool):
        """Add a tool to agent's toolbox"""
        self.tools.append(tool)
```

**Chat Agent Implementation**:
```python
# src/agents/chat_agent.py
from typing import Dict, Any
from .base_agent import BaseAgent
from ..tools.rag_tool import RAGTool
from ..tools.web_search_tool import WebSearchTool

class ChatAgent(BaseAgent):
    """Career consulting chat agent with RAG capabilities"""
    
    def __init__(self, llm, portfolio_id: str):
        super().__init__(
            llm=llm,
            system_prompt="""You are an expert career consultant. 
            Use the RAG tool to retrieve relevant information from the user's 
            career portfolio. Provide personalized, actionable advice."""
        )
        
        # Add RAG tool for portfolio retrieval
        self.add_tool(RAGTool(portfolio_id=portfolio_id))
        
        # Add web search for current market info
        self.add_tool(WebSearchTool())
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process chat message with RAG augmentation
        
        Args:
            input_data: {
                "message": str,
                "session_id": str,
                "use_rag": bool,
                "use_web_search": bool
            }
        
        Returns:
            {
                "response": str,
                "sources": List[str],
                "tool_calls": List[str]
            }
        """
        message = input_data["message"]
        use_rag = input_data.get("use_rag", True)
        
        # Build context from tools if enabled
        context = []
        sources = []
        tool_calls = []
        
        if use_rag:
            # Query portfolio with RAG
            rag_result = await self.tools[0].run(message)
            context.append(rag_result["context"])
            sources.extend(rag_result["sources"])
            tool_calls.append("RAG")
        
        # Generate response with LLM
        response = await self._generate_response(
            message=message,
            context=context
        )
        
        return {
            "response": response,
            "sources": sources,
            "tool_calls": tool_calls
        }
```

**Edit Agent Implementation**:
```python
# src/agents/edit_agent.py
from enum import Enum
from typing import Dict, Any
from .base_agent import BaseAgent

class EditMode(Enum):
    REWRITE = "rewrite"
    SHORTEN = "shorten"
    EXPAND = "expand"

class EditAgent(BaseAgent):
    """Resume and document editing agent"""
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Edit text based on mode and instructions
        
        Args:
            input_data: {
                "text": str,
                "mode": EditMode,
                "instructions": str,
                "use_rag": bool,
                "portfolio_id": Optional[str]
            }
        
        Returns:
            {
                "edited_text": str,
                "changes_summary": str,
                "word_count_before": int,
                "word_count_after": int
            }
        """
        text = input_data["text"]
        mode = EditMode(input_data["mode"])
        instructions = input_data.get("instructions", "")
        
        # Build mode-specific prompt
        if mode == EditMode.REWRITE:
            prompt = f"Rewrite the following text to be more professional and impactful:\n{instructions}\n\nText:\n{text}"
        elif mode == EditMode.SHORTEN:
            prompt = f"Condense the following text while preserving key information:\n{instructions}\n\nText:\n{text}"
        elif mode == EditMode.EXPAND:
            prompt = f"Expand the following text with more detail and context:\n{instructions}\n\nText:\n{text}"
        
        # Optionally add RAG context
        if input_data.get("use_rag") and input_data.get("portfolio_id"):
            rag_context = await self._retrieve_portfolio_context(
                input_data["portfolio_id"],
                text
            )
            prompt += f"\n\nRelevant background from portfolio:\n{rag_context}"
        
        # Generate edited text
        edited_text = await self.llm.agenerate([prompt])
        
        return {
            "edited_text": edited_text,
            "word_count_before": len(text.split()),
            "word_count_after": len(edited_text.split())
        }
```

**Interview Agent Implementation**:
```python
# src/agents/interview_agent.py
from typing import Dict, Any, List
from .base_agent import BaseAgent

class InterviewAgent(BaseAgent):
    """Interview preparation agent with Q&A generation"""
    
    async def generate_questions(
        self, 
        job_description: str, 
        difficulty: str = "medium"
    ) -> List[str]:
        """
        Generate interview questions from job description
        
        Args:
            job_description: Full job posting text
            difficulty: "easy", "medium", or "hard"
        
        Returns:
            List of interview questions
        """
        prompt = f"""Analyze this job description and generate {difficulty} 
        level interview questions that would be relevant:
        
        {job_description}
        
        Generate 10 questions covering:
        - Technical skills
        - Experience and background
        - Situational/behavioral questions
        - Problem-solving scenarios
        """
        
        questions = await self.llm.agenerate([prompt])
        return self._parse_questions(questions)
    
    async def generate_answers(
        self,
        question: str,
        portfolio_id: str
    ) -> Dict[str, Any]:
        """
        Generate personalized answer using RAG from portfolio
        
        Args:
            question: Interview question
            portfolio_id: User's portfolio ID for RAG
        
        Returns:
            {
                "answer": str,
                "sources": List[str],  # Referenced resume sections
                "key_points": List[str]
            }
        """
        # Use RAG to find relevant experience
        rag_context = await self._retrieve_portfolio_context(
            portfolio_id,
            question
        )
        
        prompt = f"""Based on this background information, provide a strong 
        interview answer to the question. Use specific examples from the 
        candidate's experience.
        
        Question: {question}
        
        Background:
        {rag_context}
        
        Provide:
        1. A complete answer (2-3 paragraphs)
        2. Key points to emphasize
        3. Specific metrics/achievements to mention
        """
        
        response = await self.llm.agenerate([prompt])
        
        return self._parse_answer_response(response)
```

**Job Suggest Agent Implementation**:
```python
# src/agents/job_agent.py
from typing import Dict, Any, List
from .base_agent import BaseAgent

class JobSuggestAgent(BaseAgent):
    """Job matching and recommendation agent"""
    
    async def analyze_profile(
        self,
        portfolio_id: str
    ) -> Dict[str, Any]:
        """
        Analyze user's career portfolio to extract profile
        
        Returns:
            {
                "skills": List[str],
                "experience_level": str,
                "industries": List[str],
                "role_types": List[str]
            }
        """
        # Retrieve full portfolio via RAG
        portfolio_docs = await self._retrieve_full_portfolio(portfolio_id)
        
        prompt = f"""Analyze this career portfolio and extract:
        
        {portfolio_docs}
        
        Provide:
        1. Technical and soft skills
        2. Experience level (entry/mid/senior)
        3. Industry background
        4. Suitable role types
        """
        
        analysis = await self.llm.agenerate([prompt])
        return self._parse_profile(analysis)
    
    async def match_jobs(
        self,
        profile: Dict[str, Any],
        job_listings: List[Dict[str, Any]],
        preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Score and rank jobs based on profile match
        
        Args:
            profile: User profile from analyze_profile
            job_listings: List of job postings
            preferences: User preferences (location, industry, etc.)
        
        Returns:
            List of matched jobs with scores:
            [
                {
                    "job": Dict,
                    "match_score": float,
                    "aligned_skills": List[str],
                    "skill_gaps": List[str],
                    "reasoning": str
                }
            ]
        """
        matches = []
        
        for job in job_listings:
            # Apply preference filters
            if not self._matches_preferences(job, preferences):
                continue
            
            # Score match with LLM
            score_prompt = f"""Score the match between this candidate profile 
            and job posting:
            
            Candidate: {profile}
            Job: {job}
            
            Provide:
            1. Match score (0-100)
            2. Aligned skills
            3. Skill gaps
            4. Brief reasoning
            """
            
            result = await self.llm.agenerate([score_prompt])
            match_data = self._parse_match_result(result)
            match_data["job"] = job
            
            matches.append(match_data)
        
        # Sort by match score
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        return matches[:20]  # Top 20 matches
```

---

### 3. API Endpoints

**Chat API**:
```python
# src/api/chat.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    session_id: str
    portfolio_id: Optional[str] = None
    use_rag: bool = True
    use_web_search: bool = False

class ChatResponse(BaseModel):
    response: str
    sources: List[str]
    session_id: str
    timestamp: str

@router.post("/message", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    user_id: str = Depends(get_current_user)
):
    """Send message to career chat agent"""
    
    # Initialize agent with user's portfolio
    agent = ChatAgent(
        llm=get_llm(),
        portfolio_id=request.portfolio_id or user_id
    )
    
    # Run agent
    result = await agent.run({
        "message": request.message,
        "session_id": request.session_id,
        "use_rag": request.use_rag,
        "use_web_search": request.use_web_search
    })
    
    # Save to session history
    await save_chat_message(
        session_id=request.session_id,
        user_message=request.message,
        assistant_message=result["response"]
    )
    
    return ChatResponse(
        response=result["response"],
        sources=result["sources"],
        session_id=request.session_id,
        timestamp=datetime.now().isoformat()
    )
```

**Portfolio API**:
```python
# src/api/portfolio.py
from fastapi import APIRouter, UploadFile, File

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    portfolio_id: str,
    document_type: str,  # "resume", "certificate", "cover_letter", etc.
    user_id: str = Depends(get_current_user)
):
    """Upload document to career portfolio"""
    
    # Save file
    file_path = await save_uploaded_file(file, user_id)
    
    # Extract text
    text = await extract_text_from_file(file_path)
    
    # Generate embeddings and store in vector DB
    await embed_and_store(
        text=text,
        portfolio_id=portfolio_id,
        document_type=document_type,
        metadata={
            "filename": file.filename,
            "upload_date": datetime.now().isoformat()
        }
    )
    
    # Update MongoDB record
    await db.portfolios.update_one(
        {"_id": portfolio_id},
        {"$push": {"documents": {
            "filename": file.filename,
            "type": document_type,
            "path": file_path,
            "uploaded_at": datetime.now()
        }}}
    )
    
    return {"status": "success", "document_id": str(ObjectId())}

@router.get("/list")
async def list_portfolios(user_id: str = Depends(get_current_user)):
    """List all portfolios for user"""
    portfolios = await db.portfolios.find({"user_id": user_id}).to_list(100)
    return portfolios
```

**Interview API**:
```python
# src/api/interview.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])

@router.post("/generate-questions")
async def generate_questions(
    job_description: str,
    difficulty: str = "medium",
    count: int = 10,
    user_id: str = Depends(get_current_user)
):
    """Generate interview questions from job description"""
    
    agent = InterviewAgent(llm=get_llm())
    questions = await agent.generate_questions(job_description, difficulty)
    
    return {
        "questions": questions[:count],
        "difficulty": difficulty
    }

@router.post("/generate-answer")
async def generate_answer(
    question: str,
    portfolio_id: str,
    user_id: str = Depends(get_current_user)
):
    """Generate personalized answer using portfolio context"""
    
    agent = InterviewAgent(llm=get_llm())
    result = await agent.generate_answers(question, portfolio_id)
    
    return result
```

---

### 4. Database Schemas

**MongoDB Schema (via Prisma)**:
```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  email         String    @unique
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  portfolios    Portfolio[]
  chatSessions  ChatSession[]
  jobs          Job[]
  
  @@map("users")
}

model Portfolio {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  
  documents   Document[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("portfolios")
}

model Document {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  filename    String
  type        String   // "resume", "certificate", "cover_letter"
  path        String
  portfolioId String   @db.ObjectId
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id])
  
  uploadedAt  DateTime @default(now())
  
  @@map("documents")
}

model ChatSession {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  title       String?
  
  messages    Message[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("chat_sessions")
}

model Message {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionId   String   @db.ObjectId
  session     ChatSession @relation(fields: [sessionId], references: [id])
  
  role        String   // "user" or "assistant"
  content     String
  sources     String[] // Referenced documents
  
  createdAt   DateTime @default(now())
  
  @@map("messages")
}

model Job {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  
  title       String
  company     String
  description String
  url         String?
  status      String   // "saved", "applied", "interview", "rejected", "offer"
  
  matchScore  Float?
  alignedSkills String[]
  skillGaps   String[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("jobs")
}
```

**Vector Database Schema**:
```python
# Conceptual schema for vector database (e.g., Pinecone, Weaviate, Qdrant)

{
  "id": "doc_chunk_12345",
  "vector": [0.123, 0.456, ...],  # 1536-dim embedding (OpenAI)
  "metadata": {
    "portfolio_id": "portfolio_abc123",
    "document_id": "doc_xyz789",
    "document_type": "resume",
    "filename": "john_doe_resume.pdf",
    "chunk_index": 0,
    "text": "Software Engineer with 5 years of experience...",
    "created_at": "2026-02-12T10:00:00Z"
  }
}
```

---

### 5. Data Flow Diagrams

**Career Chat Flow**:
```
User → Next.js UI → POST /api/chat/message
                        ↓
              Next.js API Route (auth check)
                        ↓
              FastAPI Backend: POST /api/v1/chat/message
                        ↓
              Chat Agent.run()
                        ↓
              ┌─────────┴─────────┐
              ↓                    ↓
         RAG Tool            Web Search Tool
              ↓                    ↓
      Vector DB Query       External API
              ↓                    ↓
         Retrieve Context    Retrieve Results
              └─────────┬─────────┘
                        ↓
              LLM Generation (OpenAI/Claude)
                        ↓
              Save to MongoDB (ChatSession)
                        ↓
              Return Response
                        ↓
              Next.js UI (display)
```

**Resume Upload & RAG Indexing Flow**:
```
User Upload File → Next.js UI → POST /api/portfolio/upload
                                    ↓
                        Next.js API Route (multipart)
                                    ↓
                        FastAPI: POST /api/v1/portfolio/upload
                                    ↓
                        Save File to Disk/S3
                                    ↓
                        Extract Text (PyPDF2, python-docx)
                                    ↓
                        Chunk Text (500 token chunks, 50 overlap)
                                    ↓
                        Generate Embeddings (OpenAI API)
                                    ↓
                        Store in Vector DB
                                    ↓
                        Update MongoDB Portfolio Record
                                    ↓
                        Return Success
```

**Interview Prep Flow**:
```
User Selects Job → POST /api/interview/generate-questions
                        ↓
              Interview Agent.generate_questions()
                        ↓
              Analyze Job Description (LLM)
                        ↓
              Generate 10 Questions
                        ↓
              Return Questions
                        ↓
User Clicks Question → POST /api/interview/generate-answer
                        ↓
              Interview Agent.generate_answers()
                        ↓
              RAG Query (question + portfolio_id)
                        ↓
              Retrieve Relevant Resume Sections
                        ↓
              LLM Generation (with context)
                        ↓
              Return Personalized Answer
```

---

### 6. Infrastructure & Deployment

**Docker Compose Architecture**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Next.js Frontend
  web:
    build: ./web
    ports:
      - "3782:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8001
      - AUTH_TRUST_HOST=true
      - DATABASE_URL=mongodb://mongo:27017/novusorbit
    depends_on:
      - backend
      - mongo
    networks:
      - app-network

  # FastAPI Backend
  backend:
    build: .
    ports:
      - "8001:8001"
    environment:
      - MONGODB_URL=mongodb://mongo:27017/novusorbit
      - VECTOR_DB_URL=http://qdrant:6333
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
    depends_on:
      - mongo
      - qdrant
    networks:
      - app-network

  # MongoDB
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    networks:
      - app-network

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage
    networks:
      - app-network

volumes:
  mongo-data:
  qdrant-data:

networks:
  app-network:
    driver: bridge
```

**AWS ECS Deployment** (Current Production):
```
VPC
├── Public Subnets (2 AZs)
│   └── Application Load Balancer
│       ├── Listener :443 (HTTPS) → Target Group
│       └── Listener :80 (HTTP) → Redirect 443
│
├── Private Subnets (2 AZs)
│   ├── ECS Fargate Cluster
│   │   ├── Service: web (Next.js)
│   │   │   ├── Task: web-task-1
│   │   │   └── Task: web-task-2
│   │   └── Service: backend (FastAPI)
│   │       ├── Task: backend-task-1
│   │       └── Task: backend-task-2
│   │
│   └── MongoDB (DocumentDB or Atlas)
│
├── EFS (Elastic File System)
│   └── /data (shared portfolio storage)
│
└── Security Groups
    ├── ALB-SG (80, 443 from 0.0.0.0/0)
    ├── Web-SG (3000 from ALB-SG)
    ├── Backend-SG (8001 from Web-SG)
    └── Mongo-SG (27017 from Backend-SG)
```

---

### 7. Technology Stack Summary

```yaml
Frontend:
  Framework: Next.js 16
  UI Library: React 19
  Language: TypeScript
  Styling: Tailwind CSS
  Auth: Auth.js v5 (NextAuth)
  State: React Context API
  HTTP Client: fetch API

Backend:
  Framework: FastAPI
  Language: Python 3.12
  LLM Framework: LangChain
  Agent Framework: Custom multi-agent system
  
Database:
  Primary: MongoDB (via Prisma)
  Vector DB: Qdrant / Pinecone / Weaviate
  
External APIs:
  LLM: OpenAI GPT-4 / Anthropic Claude
  Embeddings: OpenAI text-embedding-3-large
  Search: Tavily / Google Search API
  
Infrastructure:
  Containerization: Docker
  Orchestration: Docker Compose (dev), ECS Fargate (prod)
  Load Balancer: AWS ALB
  Storage: EFS (shared files)
  DNS: Route53
  CDN: CloudFront (optional)
  
Development:
  Version Control: Git
  CI/CD: GitHub Actions (or AWS CodePipeline)
  Testing: Pytest (backend), Jest (frontend)
  Linting: Ruff (Python), ESLint (TypeScript)
```

---

## Prompt for AI Architecture Generation

**Use this specification to generate:**

1. **System architecture diagram** showing all components, their connections, and data flows
2. **Component diagrams** for each major subsystem (agents, tools, services)
3. **Sequence diagrams** for key user workflows (chat, upload, interview prep)
4. **Database ER diagram** showing entity relationships
5. **Deployment diagram** showing infrastructure layout
6. **API documentation** with request/response examples
7. **Agent interaction diagrams** showing multi-agent collaboration

**Key architectural patterns to highlight:**
- Microservices architecture with API gateway
- Multi-agent orchestration with tool augmentation
- RAG (Retrieval-Augmented Generation) pipeline
- Session management and persistence
- Authentication and authorization flow
- Containerized deployment with service mesh

**Output formats:**
- Mermaid diagrams
- PlantUML diagrams
- C4 model diagrams
- Infrastructure as code (Terraform/CloudFormation)
