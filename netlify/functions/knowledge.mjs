// Portfolio Knowledge Base

export const KNOWLEDGE = {
  about: {
    summary:
      "Logan Venter is a Senior AI/Platform Engineer with over 20 years of software development experience, based in South Africa. He architects and builds production AI platforms, from multi-protocol server frameworks to agentic chatbot platforms to RAG-powered knowledge bases. His current focus is enabling organizations to deploy LLM-powered systems with enterprise-grade reliability.",
    values: [
      "Clean architecture and deliberate design decisions",
      "Deterministic systems with well-defined failure boundaries",
      "Code that communicates intent",
      "Direct feedback and honest technical discourse",
    ],
  },

  projects: [
    {
      name: "Production MCP Server Framework for .NET 9",
      category: ".NET Framework",
      description:
        "A Model Context Protocol server framework supporting multiple transport protocols with session management, JWT and API key authentication, JSON schema validation, and automatic tool discovery. Built for enterprise AI agent integrations.",
      tech: [".NET 9", "C#", "gRPC", "SignalR", "Polly", "FluentValidation"],
      highlights: [
        "Multiple transport protocols (stdio, REST, SSE, SignalR, gRPC)",
        "Session management with JWT and API key authentication",
        "JSON schema validation for tool inputs",
        "Automatic tool discovery from assemblies",
        "Enterprise-grade reliability with Polly resilience patterns",
      ],
    },
    {
      name: "Enterprise Agentic Chatbot Framework",
      category: "Full-Stack AI Platform",
      description:
        "Full-stack chatbot platform built on LangChain and LangGraph with pluggable LLM providers, RAG pipelines across multiple vector store backends, streaming responses via SSE/WebSocket, and React and Flutter frontends. Supports multi-bot routing, A/B testing, and comprehensive metrics.",
      tech: ["Python", "LangChain", "LangGraph", "FastAPI", "React", "Flutter"],
      highlights: [
        "LangChain/LangGraph orchestration with pluggable LLM providers",
        "RAG pipelines across Qdrant, FAISS, Pinecone, ChromaDB, and Weaviate",
        "Streaming responses via SSE and WebSocket",
        "Cross-platform frontends (React web, Flutter mobile/desktop)",
        "Multi-bot routing, A/B testing, and usage metrics",
      ],
    },
    {
      name: "AI-Powered Azure DevOps Integration via MCP",
      category: "Enterprise AI Integration",
      description:
        "MCP server exposing Azure DevOps operations as AI-callable tools. Enables LLM agents to manage work items, pull requests, projects, and relationships through natural language.",
      tech: [".NET 9", "C#", "Azure DevOps REST API", "MCP"],
      highlights: [
        "Work item management through natural language",
        "Pull request operations via AI agents",
        "Project and relationship management as MCP tools",
      ],
    },
    {
      name: "AI-Powered Knowledge Base System",
      category: "Knowledge Management Platform",
      description:
        "Production knowledge management platform with hierarchical document organization, semantic search via vector embeddings, dynamic Qdrant container management, and conversational RAG interface. Includes admin dashboard, file upload, and audit logging.",
      tech: [".NET 9", "Python", "React", "Qdrant", "FastAPI"],
      highlights: [
        "Hierarchical document organization with tagging",
        "Semantic search via vector embeddings",
        "Dynamic Qdrant container management",
        "Conversational RAG interface for natural language queries",
        "Admin dashboard with file upload and audit logging",
      ],
    },
  ],

  experience: [
    {
      company: "Telesure Investment Holdings",
      shortName: "TIH",
      title: "Senior AI/Platform Engineer",
      period: "Aug 2025 - Present",
      note: "Contractor via DotCom Software Solutions",
      responsibilities: [
        "Designing and building production AI platforms for enterprise LLM integrations",
        "Architecting MCP server frameworks with multi-transport support",
        "Developing agentic chatbot systems with LangChain/LangGraph orchestration",
        "Applying agentic AI design patterns: spotlighting, input/output guardrails, tool use governance, and human-in-the-loop orchestration",
        "Building knowledge base platforms with semantic search and RAG",
        "Leading technical architecture decisions and mentoring",
      ],
    },
    {
      company: "Derivco",
      title: "Senior Software Developer",
      period: "Nov 2018 - Jun 2025",
      responsibilities: [
        "Led internal AI initiative with dynamic prompt generation for OpenAI API integration",
        "Architected LLM-powered automation tools for SDET and code review workflows",
        "Applied iDesign architectural methodology for maintainable backend systems",
        "Led technical development, release, and maintenance of software systems",
        "Drove CI/CD pipelines and technical roadmap for multiple products",
        "Mentored junior developers",
      ],
    },
    {
      company: "Dynamic Visual Technologies (DVT)",
      shortName: "DVT",
      title: "Senior Software Developer GMIC.Net (Consultant)",
      period: "May 2016 - Nov 2018",
      responsibilities: [
        "Developed features and bug fixes as consultant",
        "Managed CI/CD build processes",
        "Handled branch and release management with Git",
      ],
    },
    {
      company: "Seecrypt",
      title: "Software Developer / Team Lead",
      period: "Jun 2015 - Apr 2016",
      responsibilities: [
        "Windows team lead for encrypted communications application",
        "Development in C#, C++, WPF, Silverlight",
        "Database work with SQLite-SQLCipher for encrypted storage",
      ],
    },
    {
      company: "Covariant Consulting",
      title: "Director",
      period: "Jul 2014 - May 2015",
      responsibilities: [
        "System integration with Syspro ERP",
        "Business operations and client management",
      ],
    },
    {
      company: "UD Trucks",
      title: "Software Developer",
      period: "Nov 2012 - Jun 2014",
      responsibilities: [
        "UDCS system architecture and integration",
        "Software development for logistics systems",
      ],
    },
    {
      company: "Enermatics",
      title: "Software Developer",
      period: "Apr 2011 - Oct 2012",
      responsibilities: [
        "Wattkeeper energy management system development",
        "Software engineering for energy monitoring solutions",
      ],
    },
    {
      company: "Infotech",
      title: "Software Developer",
      period: "Sep 2009 - Mar 2011",
      responsibilities: [
        "Software development and system maintenance",
        "Technical support and feature implementation",
      ],
    },
    {
      company: "Information Trade World",
      shortName: "ITW",
      title: "Programmer",
      period: "Jul 2007 - Aug 2009",
      responsibilities: [
        "Programming in COBOL, Visual Basic, and Delphi",
        "Website development",
      ],
    },
  ],

  skills: {
    languages: [
      {
        name: "C# / .NET 9",
        level: "Primary",
        description:
          "High-performance services, MCP frameworks, enterprise backend systems",
      },
      {
        name: "Python",
        level: "Primary",
        description:
          "LangChain, LangGraph, FastAPI, Pydantic, AI/ML pipelines",
      },
      {
        name: "TypeScript / React",
        level: "Strong",
        description: "Modern frontends, real-time chat interfaces",
      },
      {
        name: "Dart / Flutter",
        level: "Strong",
        description: "Cross-platform mobile and desktop applications",
      },
      {
        name: "SQL",
        level: "Strong",
        description: "T-SQL, complex schemas, query optimization",
      },
      {
        name: "C++",
        level: "Experienced",
        description: "Performance-critical and security applications",
      },
    ],
    frameworks: [
      "LangChain and LangGraph for LLM orchestration",
      "Model Context Protocol (MCP) for AI agent tooling",
      "RAG pipelines with vector databases (Qdrant, FAISS, Pinecone, ChromaDB, Weaviate)",
      "Prompt engineering and semantic search",
      "Multi-protocol backend (gRPC, SignalR, SSE, WebSocket, REST)",
      "React and TypeScript for web frontends",
      "Flutter for cross-platform mobile/desktop",
      "Tailwind CSS for styling",
      "Docker and Docker Compose for containerization",
      "Azure cloud infrastructure",
      "CI/CD pipelines",
      "xUnit and Vitest for testing",
    ],
    concepts: [
      "iDesign Methodology (trained by Juval Lowy)",
      "Domain-Driven Design (DDD)",
      "Clean Architecture",
      "Microservices and Event-Driven Architecture",
      "Authentication and Security (JWT, API keys)",
      "Agentic AI Design Patterns (spotlighting, guardrails, tool use governance, human-in-the-loop orchestration)",
      "Database and Vector Storage (PostgreSQL, SQLite, vector databases)",
    ],
  },

  education: [
    {
      institution: "Intec College",
      qualification: "Diploma in C++ Programming",
      achievement:
        "Average of 73.1% - highest score in institution history as of 2006",
      subjects: [
        "Intro to Programming",
        "C++",
        "Advanced C++",
        "Systems Analysis and Design",
        "Management Information Systems",
      ],
    },
    {
      institution: "Goudrif High School",
      qualification: "Grade 12 (Matric with Merit)",
      achievement:
        "Computer Training Institute floating trophy for best student (2002). Completed entire Matric Computer Studies syllabus in Grade 10.",
    },
  ],

  interests: {
    software: [
      "Passionate about solving hard engineering problems",
      "Built a mobile game with 8,000 downloads on Windows Phone Store",
      "Built an Eskom load-shedding monitoring app (1,200 downloads in 2 weeks)",
      "Built a TV backlight system with color perception based on pixel analysis",
    ],
    music: [
      "Guitar player and vocalist with public performance experience",
      "Original songs played on Jacaranda radio",
      "Recorded an album",
      "Songwriting as a creative outlet",
    ],
  },
};

export function searchKnowledge(query) {
  var q = query.toLowerCase();
  var results = [];

  // Search about
  if (
    q.includes("about") ||
    q.includes("who") ||
    q.includes("background") ||
    q.includes("summary") ||
    q.includes("bio")
  ) {
    results.push({
      topic: "About",
      content: KNOWLEDGE.about.summary + " Values: " + KNOWLEDGE.about.values.join("; "),
    });
  }

  // Search projects
  for (var p of KNOWLEDGE.projects) {
    if (
      q.includes("project") ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tech.some(function (t) { return q.includes(t.toLowerCase()); })
    ) {
      results.push({
        topic: "Project: " + p.name,
        content: p.description + " Tech: " + p.tech.join(", ") + ". Highlights: " + p.highlights.join("; "),
      });
    }
  }

  // Search experience
  for (var e of KNOWLEDGE.experience) {
    if (
      q.includes("experience") ||
      q.includes("work") ||
      q.includes("career") ||
      q.includes("job") ||
      e.company.toLowerCase().includes(q) ||
      (e.shortName && q.includes(e.shortName.toLowerCase())) ||
      e.title.toLowerCase().includes(q)
    ) {
      results.push({
        topic: e.title + " at " + e.company + " (" + e.period + ")",
        content: (e.note ? e.note + ". " : "") + "Responsibilities: " + e.responsibilities.join("; "),
      });
    }
  }

  // Search skills
  if (
    q.includes("skill") ||
    q.includes("tech") ||
    q.includes("stack") ||
    q.includes("language") ||
    q.includes("framework") ||
    q.includes("tool")
  ) {
    var langs = KNOWLEDGE.skills.languages
      .map(function (l) { return l.name + " (" + l.level + "): " + l.description; })
      .join("; ");
    results.push({
      topic: "Technical Skills",
      content:
        "Languages: " + langs +
        ". Frameworks: " + KNOWLEDGE.skills.frameworks.join("; ") +
        ". Architectural concepts: " + KNOWLEDGE.skills.concepts.join("; "),
    });
  }

  // Search education
  if (q.includes("education") || q.includes("diploma") || q.includes("degree") || q.includes("school") || q.includes("study")) {
    results.push({
      topic: "Education",
      content: KNOWLEDGE.education
        .map(function (e) { return e.qualification + " from " + e.institution + " - " + e.achievement; })
        .join(". "),
    });
  }

  // Search interests
  if (q.includes("interest") || q.includes("hobby") || q.includes("music") || q.includes("personal") || q.includes("game") || q.includes("app")) {
    results.push({
      topic: "Personal Interests",
      content:
        "Software: " + KNOWLEDGE.interests.software.join("; ") +
        ". Music: " + KNOWLEDGE.interests.music.join("; "),
    });
  }

  // Fallback: return about + skills summary
  if (results.length === 0) {
    results.push({
      topic: "About",
      content: KNOWLEDGE.about.summary,
    });
  }

  return results;
}

export function getProjectDetails(name) {
  var q = name.toLowerCase();
  var project = KNOWLEDGE.projects.find(function (p) {
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });
  if (!project) {
    return {
      found: false,
      message: "No project found matching '" + name + "'. Available projects: " +
        KNOWLEDGE.projects.map(function (p) { return p.name; }).join(", "),
    };
  }
  return { found: true, project: project };
}

export function getExperience(company) {
  var q = company.toLowerCase();
  var exp = KNOWLEDGE.experience.find(function (e) {
    return (
      e.company.toLowerCase().includes(q) ||
      (e.shortName && e.shortName.toLowerCase().includes(q))
    );
  });
  if (!exp) {
    return {
      found: false,
      message: "No experience found for '" + company + "'. Companies: " +
        KNOWLEDGE.experience.map(function (e) { return e.company; }).join(", "),
    };
  }
  return { found: true, experience: exp };
}

export function getSkillsByCategory(category) {
  var q = category.toLowerCase();
  if (q === "all" || q === "everything") {
    return KNOWLEDGE.skills;
  }
  if (q.includes("lang")) {
    return { languages: KNOWLEDGE.skills.languages };
  }
  if (q.includes("frame") || q.includes("tool")) {
    return { frameworks: KNOWLEDGE.skills.frameworks };
  }
  if (q.includes("concept") || q.includes("arch") || q.includes("method")) {
    return { concepts: KNOWLEDGE.skills.concepts };
  }
  return KNOWLEDGE.skills;
}
