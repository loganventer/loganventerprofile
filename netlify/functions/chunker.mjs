export function chunkKnowledge(knowledge) {
  const chunks = [];

  // About
  chunks.push({
    id: "about-summary",
    topic: "About",
    category: "about",
    content: knowledge.about.summary + " Values: " + knowledge.about.values.join("; "),
    metadata: { type: "about" },
  });

  // Projects
  for (const p of knowledge.projects) {
    const slug = p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    chunks.push({
      id: "project-" + slug,
      topic: "Project: " + p.name,
      category: "project",
      content:
        p.name + ". " + p.category + ". " + p.description +
        " Technologies: " + p.tech.join(", ") +
        ". Highlights: " + p.highlights.join("; "),
      metadata: { name: p.name, tech: p.tech },
    });
  }

  // Experience
  for (const e of knowledge.experience) {
    const slug = e.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    chunks.push({
      id: "experience-" + slug,
      topic: e.title + " at " + e.company + " (" + e.period + ")",
      category: "experience",
      content:
        e.title + " at " + e.company + " (" + e.period + "). " +
        (e.note ? e.note + ". " : "") +
        (e.shortName ? "Also known as " + e.shortName + ". " : "") +
        "Responsibilities: " + e.responsibilities.join("; "),
      metadata: { company: e.company, period: e.period },
    });
  }

  // Skills — languages
  const langContent = knowledge.skills.languages
    .map((l) => l.name + " (" + l.level + "): " + l.description)
    .join("; ");
  chunks.push({
    id: "skills-languages",
    topic: "Technical Skills - Languages",
    category: "skills",
    content: "Programming languages: " + langContent,
    metadata: { type: "languages" },
  });

  // Skills — frameworks
  chunks.push({
    id: "skills-frameworks",
    topic: "Technical Skills - Frameworks & Tools",
    category: "skills",
    content: "Frameworks and tools: " + knowledge.skills.frameworks.join("; "),
    metadata: { type: "frameworks" },
  });

  // Skills — concepts
  chunks.push({
    id: "skills-concepts",
    topic: "Technical Skills - Architectural Concepts",
    category: "skills",
    content: "Architectural concepts and methodologies: " + knowledge.skills.concepts.join("; "),
    metadata: { type: "concepts" },
  });

  // Education
  for (const ed of knowledge.education) {
    const slug = ed.institution
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const subjects = ed.subjects ? " Subjects: " + ed.subjects.join(", ") + "." : "";
    chunks.push({
      id: "education-" + slug,
      topic: "Education: " + ed.institution,
      category: "education",
      content:
        ed.qualification + " from " + ed.institution + ". " +
        ed.achievement + "." + subjects,
      metadata: { institution: ed.institution },
    });
  }

  // Interests — software
  chunks.push({
    id: "interests-software",
    topic: "Personal Interests - Software",
    category: "interests",
    content: "Software interests: " + knowledge.interests.software.join("; "),
    metadata: { type: "software" },
  });

  // Interests — music
  chunks.push({
    id: "interests-music",
    topic: "Personal Interests - Music",
    category: "interests",
    content: "Music interests: " + knowledge.interests.music.join("; "),
    metadata: { type: "music" },
  });

  // Portfolio sections
  for (const [key, section] of Object.entries(knowledge.portfolio)) {
    chunks.push({
      id: "portfolio-" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()),
      topic: section.title,
      category: "portfolio",
      content: section.title + ". " + section.description,
      metadata: { section: key },
    });
  }

  return chunks;
}
