import { searchKnowledge, getProjectDetails, getExperience, getSkillsByCategory, getPortfolioInfo } from "./knowledge.mjs";
import { createRagPipeline } from "./rag-pipeline.mjs";

const TOOLS = [
  {
    name: "search_knowledge",
    description: "Search Logan's portfolio knowledge base for information about his experience, skills, projects, education, interests, or background. Use this for general or broad queries.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_project_details",
    description: "Get detailed information about a specific featured project by name. Projects include: MCP Server Framework, Chatbot Framework, Azure DevOps Integration, Knowledge Base System.",
    input_schema: {
      type: "object",
      properties: {
        project_name: { type: "string", description: "Name or keyword of the project to look up" },
      },
      required: ["project_name"],
    },
  },
  {
    name: "get_experience",
    description: "Get details about Logan's work experience at a specific company. Companies include: TIH, Derivco, DVT, Seecrypt, Covariant, UD Trucks, Enermatics, Infotech, ITW.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name or abbreviation" },
      },
      required: ["company"],
    },
  },
  {
    name: "get_skills",
    description: "Get Logan's technical skills filtered by category: 'languages', 'frameworks', 'concepts', or 'all'.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Skill category: languages, frameworks, concepts, or all" },
      },
      required: ["category"],
    },
  },
  {
    name: "get_portfolio_info",
    description: "Get information about how this portfolio website is built, its architecture, technology choices, and design patterns. Topics include: frontend, theming, chatbot, security, access control, diagrams, background animation, PWA, deployment.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Topic to look up: overview, frontend, theming, chatbot, security, access, diagrams, animation, pwa, deployment, or a general question" },
      },
      required: ["topic"],
    },
  },
];

let pipeline = null;

function getRagPipeline() {
  if (!pipeline) pipeline = createRagPipeline();
  return pipeline;
}

const EXECUTORS = {
  search_knowledge: (input) => getRagPipeline().search(input.query),
  get_project_details: (input) => JSON.stringify(getProjectDetails(input.project_name)),
  get_experience: (input) => JSON.stringify(getExperience(input.company)),
  get_skills: (input) => JSON.stringify(getSkillsByCategory(input.category)),
  get_portfolio_info: (input) => JSON.stringify(getPortfolioInfo(input.topic)),
};

const VALIDATORS = {
  search_knowledge: (input) => typeof input.query === "string" && input.query.length <= 500,
  get_project_details: (input) => typeof input.project_name === "string" && input.project_name.length <= 200,
  get_experience: (input) => typeof input.company === "string" && input.company.length <= 200,
  get_skills: (input) => typeof input.category === "string" && input.category.length <= 100,
  get_portfolio_info: (input) => typeof input.topic === "string" && input.topic.length <= 200,
};

export function createLocalToolProvider() {
  return {
    name: "local",
    async initialize() {},
    async getTools() { return TOOLS; },
    async executeTool(name, input) {
      const executor = EXECUTORS[name];
      if (!executor) return JSON.stringify({ error: "Unknown tool: " + name });
      return executor(input);
    },
    validateToolInput(name, input) {
      const validator = VALIDATORS[name];
      return validator ? validator(input) : false;
    },
    async dispose() {},
    isAvailable() { return true; },
  };
}
